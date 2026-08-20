<h1 align="center">🎮 controlla</h1>

<p align="center">Fine-grained reactive state and fully typed router for React - async, derived, persisted, and keyed controls with surgical re-renders.</p>

<p align="center">
  <img alt="npm" src="https://img.shields.io/npm/v/controlla.svg" />
  <img alt="bundle" src="https://img.shields.io/bundlephobia/minzip/controlla.svg" />
  <img alt="types" src="https://img.shields.io/npm/types/controlla.svg" />
  <img alt="license" src="https://img.shields.io/npm/l/controlla.svg" />
</p>

A **control** is a reactive value you read, write, derive from, persist, and subscribe to. Writes notify only the paths that actually changed - no selectors, no context, no re-render storms.

- 🎯 **Fine-grained**: a write touches only the fields that changed - `$user.profile.name` is its own control.
- ⚡ **Built-in async**: loading / ready / error states, Suspense, request & polling loaders.
- 🔗 **Derived & combined**: controls that recompute only when their sources are ready.
- 🗂️ **Keyed registries**: one control per key, created on demand.
- 📝 **Forms**: validation, submit sweeps, dirty tracking and keyed field arrays over the controls you already have - uncontrolled inputs, so typing re-renders nothing.
- 🗺️ **Typed router**: a typed path tree instead of URL strings, params/query/hash as controls, anchors with scroll restoration, and navigation blocking - all built in.
- 💾 **Persistence**: `localStorage` / `sessionStorage`, observable across tabs.
- ⏱️ **Batching & scheduling**: microtask by default; throttle, debounce, manual.
- 🌳 **Tree-shakeable & typed**: zero setup, one tiny dependency, and per-export subpath imports for guaranteed minimal bundles.

```bash
pnpm add controlla
```

```bash
yarn add controlla
```

```bash
npm install --save controlla
```

> Requires React 17 or above. Runs anywhere - where `WeakRef`/`FinalizationRegistry` are missing (React Native's Hermes, browsers older than mid-2020) controls are kept alive instead of collected: behavior is identical, memory just isn't reclaimed on its own.

## Quick start

A control lives **outside React** (no provider, no context). It's a tree of controls - every nested field (`$form.name`, `$form.address.city`) is a control of its own, and a component subscribes to exactly the one it reads. Write a field and **only the components reading that field re-render**; siblings don't:

```tsx
import createControl from 'controlla/core/createControl';
import useValue from 'controlla/core/useValue';
import setValue from 'controlla/core/setValue';

const $form = createControl({ name: '', email: '', agree: false });

const NameInput = () => {
  const name = useValue($form.name);     // subscribes to .name only
  return <input value={name} onChange={(e) => setValue($form.name, e.target.value)} />;
};

const Submit = () => {
  const agree = useValue($form.agree);   // typing in NameInput never re-renders this
  return <button disabled={!agree}>Submit</button>;
};
```

No reducers, no selectors, no memoization - `setValue($form.name, …)` notifies `.name` (and `$form`), nothing else.

Async data is **state too**, not fetch-glue in components. A `createRegistry` of async controls gives you one cached, self-fetching resource per key - fetched on first use, deduped, suspendable, refetchable:

```tsx
import createRegistry from 'controlla/core/createRegistry';
import createAsyncControl from 'controlla/core/createAsyncControl';
import requestLoader from 'controlla/loader/requestLoader';
import SuspenseControlConsumer from 'controlla/core/SuspenseControlConsumer';
import invalidate from 'controlla/core/invalidate';

const users = createRegistry(
  createAsyncControl,
  requestLoader((id: number) => fetch(`/api/users/${id}`).then((r) => r.json()))
);

const UserCard = ({ id }: { id: number }) => (
  <SuspenseControlConsumer
    control={users.get(id)}                 // fetches on first render, cached after
    fallback={<p>Loading…</p>}
    render={(user) => <h2>{user.name}</h2>}
  />
);

const refresh = (id: number) => invalidate(users.get(id));   // refetch one user
```

controlla also ships a full **router**. Routes are a typed tree, not URL strings - every dynamic piece of the URL (path params, query, hash) is a control just like the ones above, so it reads and writes the same way while the address bar follows along on its own:

```tsx
import createRouter from 'controlla/router/createRouter';
import createPath from 'controlla/router/createPath';
import param from 'controlla/router/param';
import navigate from 'controlla/router/navigate';
import selectParams from 'controlla/router/selectParams';
import useValue from 'controlla/core/useValue';

const router = createRouter({
  product: createPath('product', param({ id: { parse: Number, stringify: String } })),
});

navigate(router.navigation.product({ id: 42 }));   // → /product/42

const $product = selectParams(router.routes.product);

const ProductPage = () => {
  const id = useValue($product.id);   // re-renders only when id changes
  return <h1>Product #{id}</h1>;
};
```

See the [Router](#router) section for paths, navigation, params, anchors and more.

For working code rather than snippets, [`examples/`](examples) has twelve standalone apps, ordered from a counter to a small multi-page job board - one per topic, each runnable and readable on its own.

> Everything is importable two ways: from the root (`import { createControl, useValue } from 'controlla'`) or as its own subpath (`controlla/<domain>/<name>`, as in the examples above). Both tree-shake in a modern bundler, but subpaths make the minimal bundle a guarantee instead of an optimization - prefer them. Controls are conventionally named with a leading `$`.

---

## Contents

- **Controls**: [`createControl`](#createcontrol--usecontrol), [`createPrimitiveControl`](#createprimitivecontrol--useprimitivecontrol), [`createAsyncControl`](#createasynccontrol--useasynccontrol), [`createDerivedControl`](#createderivedcontrol--usederivedcontrol), [`createAsyncDerivedControl`](#createasyncderivedcontrol--useasyncderivedcontrol), [`createSnapshotControl`](#createsnapshotcontrol--usesnapshotcontrol)
- **Controls context**: [`createControlsContext`](#createcontrolscontextcreatecontrols-useparentcontrols)
- **Reading values**: [`getValue`](#getvaluecontrol), [`useValue`](#usevaluecontrol), [`toPromise`](#topromisecontrol), [`useSuspenseValue`](#usesuspensevaluecontrol-safe), [`useSuspenseValues`](#usesuspensevaluescontrols-safe), [`useInfiniteValues`](#useinfinitevaluescontrols)
- **Writing values**: [`setValue`](#setvaluecontrol-value-scheduler), [`invalidate`](#invalidatecontrol-silentorscheduler)
- **Subscribing**: [`watchValue`](#watchvaluecontrol-callback-immediate-withempty), [`watchValues`](#watchvaluescontrols-callback-immediate-withempty), [`retain`](#retaincontrol), [`watchSlowLoading`](#watchslowloadingcontrol-callback)
- **Async status**: [`selectLoading`](#selectloadingcontrol), [`selectReady`](#selectreadycontrol), [`selectError`](#selecterrorcontrol)
- **Components**: [`ControlConsumer`](#controlconsumer), [`ControlsConsumer`](#controlsconsumer), [`CombinedControlsConsumer`](#combinedcontrolsconsumer), [`InfiniteControlsConsumer`](#infinitecontrolsconsumer), [`SuspenseControlConsumer`](#suspensecontrolconsumer), [`SuspenseControlsConsumer`](#suspensecontrolsconsumer)
- **Utils**: [`$never`](#never), [`isAggregateControlError`](#isaggregatecontrolerrorerr), [`isSourceUpdate`](#issourceupdate)
- **Registry**: [`createRegistry`](#createregistrycreate-initarg-options)
- **Loaders**: [`requestLoader`](#requestloaderfetch-options-scheduler), [`pollLoader`](#pollloaderfetch-options-scheduler)
- **Persistence**: [`getPersistStorage`](#getpersiststorageoptions), [`safeLocalStorage`](#safelocalstorage), [`safeSessionStorage`](#safesessionstorage)
- **DOM**: [`mediaQuery`](#mediaqueryquery), [`$online`](#online), [`$pageVisible`](#pagevisible), [`$windowSize`](#windowsize)
- **Schedulers**: [`batch`](#batchcallback-scheduler), [`createManualScheduler`](#createmanualscheduler), [`createThrottleScheduler`](#createthrottleschedulerms), [`createDebounceScheduler`](#createdebounceschedulerms)
- **Forms**: [`useForm`](#useformcontrol-options), [`FormProvider`](#formprovider-form), [`useValidator`](#usevalidatorcontrol-validate-validateon--validator), [`usePathValidator`](#usepathvalidatorcontrol-validate-validateon--pathvalidator), [`useNativeField`](#usenativefieldcontrol-options--nativefield), [`useField`](#usefieldcontrol--field), [`useFieldArray`](#usefieldarraycontrol), [`useFieldState`](#usefieldstatecontrol), [`useFormState`](#useformstate)
- **Router**: [`createRouter`](#createrouterpaths), [`createPath`](#createpathpath), [`createAsyncPath`](#createasyncpathsource), [`param`](#paramoptions), [`query`](#queryoptions), [`oneOf`](#oneofoptions), [`arrayParam`](#arrayparamoptions), [`createRouterView`](#createrouterviewroutes), [`Link` / `useLink`](#link--uselink), [`navigate`](#navigateto-replace-ignoreblock-scrolltotop-scrollrestoration), [params as controls](#route-params-are-controls), [`replaceValue`](#replacevaluecontrol-value-scheduler), [anchors](#anchors), [`registerAnchorOffset`](#registeranchoroffsetroute), [`selectRegisteredAnchors`](#selectregisteredanchorsroute), [`trackScroll`](#trackscrollanchor), [`navigationBlocker`](#blocking-navigation), [`repairHistory`](#repairhistory)
- **[Troubleshooting](#troubleshooting)**: [param value type + `stringify`](#paramquery-value-type-breaks-when-stringify-is-present), [named import suggestions in VS Code](#get-named-controlla-import-suggestions-in-vs-code)

---

## Controls

Each creator has a `use*` twin (`controlla/core/use*`) that does the same but binds the control to a React component - created on first render, the same instance afterwards. Pass a factory (`() => …`) to build it once when the argument is expensive.

### `createControl` / `useControl`

A control with **granular reactivity**: nested fields are reachable as controls of their own via property access, and a change notifies only the paths it actually touched.

```ts
createControl(initialValue?, externalStorage?)
useControl(initialValue?, externalStorage?)
```

| Parameter | Type | Description |
|---|---|---|
| `initialValue?` | `T` or `() => T` | Initial value, or a lazy initializer. |
| `externalStorage?` | `SyncExternalStorage` | External storage backing the value: the control starts from the stored value, writes changes back and, if the storage is observable, picks up external changes. Any storage with sync reads works: e.g. one from [`getPersistStorage`](#getpersiststorageoptions). |

```ts
const $user = createControl({ profile: { name: 'John', age: 30 } });   // value
const $draft = createControl(() => ({ id: crypto.randomUUID(), text: '' }));   // lazy initializer
const $note = createControl<string>();                                 // empty (undefined)

const $name = $user.profile.name;     // nested field = its own control
setValue($name, 'Jane');              // notifies $name + $user, not $user.profile.age

const $local = useControl(0);         // component-scoped (inside a component)
```

### `createPrimitiveControl` / `usePrimitiveControl`

A lightweight control whose value is **opaque** - no nested-path access, changes detected by reference (`!==`). Cheaper than `createControl` - replace objects instead of mutating them.

```ts
createPrimitiveControl(initialValue?, externalStorage?)
usePrimitiveControl(initialValue?, externalStorage?)
```

| Parameter | Type | Description |
|---|---|---|
| `initialValue?` | `T` or `() => T` | Initial value, or a lazy initializer. |
| `externalStorage?` | `SyncExternalStorage` | External storage backing the value, as in [`createControl`](#createcontrol--usecontrol). |

```ts
const $count = createPrimitiveControl(0);                       // value
const $token = createPrimitiveControl<string>();                // empty (undefined)
const $id = usePrimitiveControl(() => crypto.randomUUID());     // component-scoped, lazy
```

### `createAsyncControl` / `useAsyncControl`

A control for an **asynchronously-arriving** value, with loading / ready / error status (`ready` = has a value; see [`selectReady`](#selectreadycontrol)).

```ts
createAsyncControl(options?, externalStorage?)
useAsyncControl(options?, externalStorage?)   // options or () => options
```

| Parameter | Type | Description |
|---|---|---|
| `options?` | `AsyncControlOptions` | See below. |
| `externalStorage?` | `SyncExternalStorage` | External storage backing the value, as in [`createControl`](#createcontrol--usecontrol). |

**`AsyncControlOptions`**

| Field | Type | Description |
|---|---|---|
| `initialValue?` | `T` or `(...keys) => T` | Initial value (keys come from a registry). |
| `load?` | `(handle, keys?) => void` | Starts loading; reports via `handle`. Usually from a [loader](#loaders). Omit for a manual control. May return a cleanup run when loading ends/cancels. |
| `isLoaded?` | `(value, prevValue, attempt) => boolean` | Whether a committed value is final; until `true` the control stays loading (multi-attempt/streamed). |
| `reloadIfStale?` | `number` (ms) | Reload on use if this long passed since the last load. |
| `reloadOnFocus?` | `number` (ms) | Reload on tab focus if this long passed. |
| `revalidate?` | `boolean` | Reload on use even when a value already exists (e.g. from storage). |
| `loadingTimeout?` | `number` (ms) | After this, [`watchSlowLoading`](#watchslowloadingcontrol-callback) fires. |

**`load` handle**

| Method | Returns | Description |
|---|---|---|
| `setValue(value, scheduler?)` | `boolean` | Commit a value. `true` = still loading after (e.g. keep polling). |
| `setError(error, scheduler?)` | `void` | Commit a loading error, end loading. |
| `getValue()` | `T` or `undefined` | Current value. |

```ts
// loadable: fetches on first use
const $products = createAsyncControl(
  requestLoader(() => fetch('/api/products').then((r) => r.json()))
);

// manual: value pushed from outside
const $position = createAsyncControl<GeolocationPosition>();
navigator.geolocation.watchPosition((pos) => setValue($position, pos));

// component-scoped: factory builds the loader once
const $me = useAsyncControl(() =>
  requestLoader(() => fetch('/api/me').then((r) => r.json()))
);
```

### `createDerivedControl` / `useDerivedControl`

A control computed from one or more source controls, recomputing on any source change. With no mapper it mirrors a single source.

Settable via `setValue` as a local override, but a source recompute overrides it; if a source change and a `setValue` on the derived control land in the **same flush**, the source wins.

```ts
createDerivedControl(...controls, mapper?)
useDerivedControl(...controls, mapper?)
```

| Parameter | Type | Description |
|---|---|---|
| `...controls` | `ReadonlyControl[]` | One or more source controls. |
| `mapper?` | `(...values) => result` | Combines the sources' current values. Runs on every change; async sources provide `value` or `undefined`. A throw is reported to `reportError` and the control keeps its previous value. |

```ts
const $copy = createDerivedControl($source);                                  // mirror one source
const $count = createDerivedControl($items, (items) => items?.length ?? 0);   // map one source
const $fullName = createDerivedControl($first, $last, (f, l) => `${f} ${l}`); // combine many
```

`useDerivedControl` rebuilds the control only when a source changes identity, and captures `mapper` at that point - so the hook's mapper must derive its result from its arguments alone, not from props or state it closes over.

### `createAsyncDerivedControl` / `useAsyncDerivedControl`

An async control computed from sources. The mapper runs only while **every** source is ready (has a value) and error-free; otherwise the control is loading, or holds an [`AggregateControlError`](#isaggregatecontrolerrorerr) with the source errors (last slot = the mapper's own throw). Using it loads loadable sources; `invalidate` reloads them.

Settable via `setValue` as a local override, but a source recompute overrides it; if a source change and a `setValue` on the derived control land in the **same flush**, the source wins.

```ts
createAsyncDerivedControl(...controls, mapper?)
useAsyncDerivedControl(...controls, mapper?)
```

| Parameter | Type | Description |
|---|---|---|
| `...controls` | `ReadonlyControl[]` | One or more source controls (sync or async). |
| `mapper?` | `(...values) => result` | Runs when all sources ready. Returning `undefined` keeps loading; throwing sets the error. |

```ts
const $mirror = createAsyncDerivedControl($asyncSource);                  // mirror an async source
const $fromSync = createAsyncDerivedControl($syncSource);                 // sync → async (ready once value !== undefined)
const $userName = createAsyncDerivedControl($user, (user) => user.name);  // map one source
const $total = createAsyncDerivedControl($cart, $rates, (cart, rates) => cart.total * rates.usd); // combine many
```

### `createSnapshotControl` / `useSnapshotControl`

[`createAsyncDerivedControl`](#createasyncderivedcontrol--useasyncderivedcontrol) computed **once** - at the first moment every source is ready and error-free. The sources are dropped right after, so later source changes and reloads leave the value alone and it stays freely settable. Sources that are already ready are never even subscribed to.

Until that moment it behaves like any async control: loading, or holding an [`AggregateControlError`](#isaggregatecontrolerrorerr). Using it still loads loadable sources and `invalidate` still reloads them - the value just no longer follows.

```ts
createSnapshotControl(...controls, mapper?)
useSnapshotControl(...controls, mapper?)
```

| Parameter | Type | Description |
|---|---|---|
| `...controls` | `ReadonlyControl[]` | One or more source controls (sync or async). |
| `mapper?` | `(...values) => result` | Runs once, when all sources are ready. Returning `undefined` waits for the next value; throwing sets the error. |

```ts
// a draft to edit, seeded from the server once
const $draft = createSnapshotControl($user, (user) => ({ ...user }));
```

---

## Controls context

### `createControlsContext(createControls, useParentControls?)`

Builds a bag of controls and registries **per mounted provider** instead of per module, so a subtree owns its own state - two instances of a screen don't share it. Returns the provider and the hook that reads it.

```tsx
const [Provider, useControls] = createControlsContext(createControls, useParentControls?)
```

| Parameter | Type | Description |
|---|---|---|
| `createControls` | `(parent?) => bag` | Runs once per mounted provider, returning a record of controls and registries. |
| `useParentControls?` | `() => parent` | Any hook - its result is passed to `createControls`, so a bag can build on an enclosing one. |

The bag is built on the provider's first render and kept for the provider's whole life, so the context value never changes. The hook throws when used outside its provider.

```tsx
const [SearchProvider, useSearch] = createControlsContext(() => ({
  query: createPrimitiveControl(''),
  page: createPrimitiveControl(1),
}));

const Input = () => {
  const { query } = useSearch();

  return (
    <input
      value={useValue(query)}
      onChange={(e) => setValue(query, e.target.value)}
    />
  );
};

const Page = () => (
  <SearchProvider>
    <Input />
  </SearchProvider>
);
```

Pass a hook as the second argument to build on an enclosing bag. It runs on every render while `createControls` runs once, so the bag keeps the parent it saw first:

```tsx
const [FiltersProvider, useFilters] = createControlsContext(
  ({ query }) => ({
    tags: createPrimitiveControl<string[]>([]),
    hits: createDerivedControl(query, search),
  }),
  useSearch
);
```

---

## Reading values

### `getValue(control)`

The control's current value, **without subscribing**. Async → `undefined` until ready (has a value). Doesn't start loading.

| Parameter | Type | Description |
|---|---|---|
| `control` | `ReadonlyControl` | The control to read. |

### `useValue(control)`

The current value in a React component, **re-rendering on change**. Async → `undefined` until ready (has a value); using it **starts loading**.

| Parameter | Type | Description |
|---|---|---|
| `control` | `ReadonlyControl` (or falsy) | The control; falsy → returns `undefined`. |

```ts
const name = useValue($name);
```

### `toPromise(control)`

A promise that **resolves** with an async control's value once ready, or **rejects** with its error. Doesn't start loading (the control must be in use or held via [`retain`](#retaincontrol)).

| Parameter | Type | Description |
|---|---|---|
| `control` | `ReadonlyAsyncControl` | The async control. |

```ts
const user = await toPromise($user);
```

### `useSuspenseValue(control, safe?)`

The value of an async control, **suspending** while it loads. Needs a `React.Suspense` boundary above.

| Parameter | Type | Description |
|---|---|---|
| `control` | `ReadonlyAsyncControl` (or falsy) | The async control; falsy → returns `undefined`. |
| `safe?` | `boolean` | If `true`, returns `[value, error]` instead of throwing the error to the boundary. |

```ts
const user = useSuspenseValue($user);
const [user, error] = useSuspenseValue($user, true);
```

### `useSuspenseValues(controls, safe?)`

Like `useSuspenseValue` for an array - suspends until **all** are ready. Array length must stay constant across renders.

| Parameter | Type | Description |
|---|---|---|
| `controls` | `ReadonlyAsyncControl[]` | The async controls. |
| `safe?` | `boolean` | If `true`, returns `[values, errors]`. |

```ts
const [user, cart] = useSuspenseValues([$user, $cart]);
```

### `useInfiniteValues(controls)`

Current values of a **dynamic-length** list of same-typed controls (the array may grow/shrink between renders): for paginated/infinite data. Async controls provide `value` or `undefined` and start loading when consumed.

| Parameter | Type | Description |
|---|---|---|
| `controls` | `ReadonlyControl[]` | Same-typed controls; length may change between renders. |

```ts
const pages = useInfiniteValues(pageNumbers.map((p) => productsRegistry.get(p)));
```

---

## Writing values

### `setValue(control, value, scheduler?)`

Sets a control's value. Batched - committed on the next flush, notifying only changed paths.

| Parameter | Type | Description |
|---|---|---|
| `control` | `Control` | The control to set. |
| `value` | `T` or `(prev) => T` | New value, or an updater. |
| `scheduler?` | `Scheduler` | Batches the commit (microtask by default). |

```ts
setValue($count, 5);
setValue($count, (prev) => prev + 1);
setValue($user.profile.name, 'Jane');           // nested
setValue($filter, value, requestAnimationFrame); // commit before next paint (any scheduler works)
```

### `invalidate(control, silentOrScheduler?)`

Resets an async control (clears value, error and ready status) and reloads if it's in use. Returns a promise of what the reload brings in, rejected with its error if it fails - the reload's own answer, not the value still in hand: the promise is armed by the call, so awaiting it right after is safe even for a silent reload that keeps its value. Like [`toPromise`](#topromisecontrol) it doesn't start the loading itself, so over a control nothing is using it stays pending until something does.

| Parameter | Type | Description |
|---|---|---|
| `control` | `AsyncControl` | The async control. |
| `silentOrScheduler?` | `boolean` or `Scheduler` | `true` keeps the current value while reloading (stale-while-revalidate); or a `Scheduler` to batch the flush. |

```ts
invalidate($user);
invalidate($user, true);        // keep value while reloading

await api.save(values);

const fresh = await invalidate($user, true);   // what the server has now
```

---

## Subscribing

### `watchValue(control, callback, immediate?, withEmpty?)`

Runs `callback` on every value change. Returns an **unwatch** function.

**Only values count.** An async control says nothing when its first value arrives, nor while an `invalidate` leaves it with none - what comes back is reported as a change from the last value handed over, so the callback never sees `undefined` in between. Pass `withEmpty` to watch those stretches too.

| Parameter | Type | Description |
|---|---|---|
| `control` | `ReadonlyControl` | The control. |
| `callback` | `(value, prevValue) => void` | May return a cleanup, run before the next call and on unwatch. |
| `immediate?` | `boolean` | If `true`, also runs now with the current value (previous = `undefined`) - or with the first one, if the control has none yet. |
| `withEmpty?` | `true` | Reports the empty stretches as well: both arguments come as `undefined` for those. Async controls only. |

```ts
const unwatch = watchValue($theme, (theme, prevTheme) => {
  console.log(`theme: ${prevTheme} -> ${theme}`);
});

// what someone edited, not the settings landing from the server
watchValue($settings, () => form.submit());
```

### `watchValues(controls, callback, immediate?, withEmpty?)`

Like `watchValue` for multiple controls - one call per flush.

**Only full tuples count.** Nothing is reported while any of them holds no value; whatever moved meanwhile is kept and goes out with the rest once the tuple is complete.

| Parameter | Type | Description |
|---|---|---|
| `controls` | `ReadonlyControl[]` | The controls. |
| `callback` | `(values, prevValues) => void` | Positional value arrays; may return a cleanup. |
| `immediate?` | `boolean` | Also run now with the current values (previous = all `undefined`) - or with the first complete tuple. |
| `withEmpty?` | `true` | Reports the empty stretches as well: that control's place in both tuples comes as `undefined`. |

```ts
const unwatch = watchValues([$query, $page], ([query, page]) => {
  console.log(`search: "${query}", page ${page}`);
});
```

### `retain(control)`

Keeps the control **in use without reading its value** → if it hasn't loaded yet, starts its load; if it's already loaded, nothing reloads — but the hold keeps it in use, so an `invalidate` while held loads it again and any polling/revalidation keeps running. Use it to prefetch data before it's shown, or keep it updating in the background. For derived/bound controls it keeps their loadable sources in use. Returns a `release` function; once released and nothing else is using the control, it stops loading (any polling halts). Calling release more than once does nothing.

| Parameter | Type | Description |
|---|---|---|
| `control` | `ReadonlyControl` | The control to keep loading. |

```ts
const release = retain($products); // prefetch / keep warm
// ...later
release();
```

### `watchSlowLoading(control, callback)`

Calls `callback` when a load exceeds the control's `loadingTimeout`. Returns an **unwatch** function. Throws if the control was created without `loadingTimeout`.

| Parameter | Type | Description |
|---|---|---|
| `control` | `AsyncControl` | The async control. |
| `callback` | `() => void` | Run when a load is slow. |

```ts
const unwatch = watchSlowLoading($products, () => console.warn('products are slow to load'));
```

---

## Async status

`selectLoading` / `selectReady` / `selectError` return sub-controls you can read like any control (`useValue`, `watchValue`, Consumers).

### `selectLoading(control)`
Returns a `boolean` control - `true` while a load is in flight, `false` otherwise.

| Parameter | Type | Description |
|---|---|---|
| `control` | `ReadonlyAsyncControl` | The async control. |

### `selectReady(control)`
Returns a `true`/`undefined` control - `true` once the control has a value (ready), `undefined` before it ever resolves or while pending with no value (first load, after `invalidate`). Distinct from loading - it stays `true` through a background reload that keeps the value. Await/suspend on readiness without re-rendering on every value change.

| Parameter | Type | Description |
|---|---|---|
| `control` | `ReadonlyAsyncControl` | The async control. |

### `selectError(control)`
Returns a control with the current error (`undefined` while error-free).

| Parameter | Type | Description |
|---|---|---|
| `control` | `ReadonlyAsyncControl` | The async control. |

```ts
const loading = useValue(selectLoading($products));
const error = useValue(selectError($products));
```

---

## Components

### `<ControlConsumer>`

Renders a control's value, **scoping the subscription** (and re-renders) to this component. Three forms: render-prop, truthy gate (children shown while truthy), primitive display (value rendered directly).

| Prop | Type | Description |
|---|---|---|
| `control` | `ReadonlyControl` | The control. |
| `render?` | `(value) => ReactNode` | Render-prop form. |
| `children?` | `ReactNode` | Truthy-gate form (shown while value is truthy). |

```jsx
<ControlConsumer control={$name} render={(name) => <div>{name}</div>} />   {/* render */}
<ControlConsumer control={$saved}><p>Saved ✓</p></ControlConsumer>          {/* truthy gate */}
<span>Total: <ControlConsumer control={$total} /></span>                   {/* primitive display */}
```

### `<ControlsConsumer>`

Multi-control `ControlConsumer`.

| Prop | Type | Description |
|---|---|---|
| `controls` | `ReadonlyControl[]` (falsy entries allowed) | Entries may be falsy; array length constant. |
| `render` | `(...values) => ReactNode` | Positional values. |

```jsx
<ControlsConsumer
  controls={[$user, $cart]}
  render={(user, cart) => <p>{user.name}: {cart.length} items</p>}
/>
```

### `<CombinedControlsConsumer>`

Combines multiple controls through a `combiner` and consumes the result — re-renders only when the **combined value** changes (unlike `ControlsConsumer`, which reruns on every source change). Component form of [`useDerivedControl`](#createderivedcontrol--usederivedcontrol) + `ControlConsumer`. Same three forms as `ControlConsumer`. The derived control is rebuilt when a `controls` entry changes identity, and `combiner` is captured then - so it must derive its result only from the values passed in, not from props or state it closes over.

| Prop | Type | Description |
|---|---|---|
| `controls` | `ReadonlyControl[]` | Combined positionally; async controls give `value \| undefined`. |
| `combiner` | `(...values) => T` | Derives the value; reruns per source change, deduped on result. |
| `render?` | `(value: T) => ReactNode` | Render-prop form. |
| `children?` | `ReactNode` | Truthy-gate form (shown while combined value is truthy). |

```jsx
<CombinedControlsConsumer
  controls={[$firstName, $lastName]}
  combiner={(first, last) => `${first} ${last}`}
  render={(fullName) => <h1>{fullName}</h1>}
/>
```

### `<InfiniteControlsConsumer>`

Render-prop over a **dynamic-length** list of same-typed controls (component form of [`useInfiniteValues`](#useinfinitevaluescontrols)).

| Prop | Type | Description |
|---|---|---|
| `controls` | `ReadonlyControl[]` | Same-typed; length may change between renders. |
| `render` | `(values) => ReactNode` | Renders the values array. |

### `<SuspenseControlConsumer>`

Renders an async control with **its own** `Suspense` boundary (no outer one needed); using it starts loading.

| Prop | Type | Description |
|---|---|---|
| `control` | `ReadonlyAsyncControl` | The async control. |
| `render?` | `(value) => ReactNode` | Render-prop form. |
| `children?` | `ReactNode` | Truthy-gate form. |
| `fallback` | `ReactNode` | Shown while loading. |
| `renderIfError?` | render fn, `ReactNode`, or `true` | Render the error instead of throwing it (`true` = show fallback). |
| `container?` | `ContainerComponent` | Wraps content/fallback only when there is something to show. |

```jsx
{/* render */}
<SuspenseControlConsumer
  control={$user}
  fallback={<p>Loading…</p>}
  render={(user) => <h2>{user.name}</h2>}
  renderIfError={(error) => <p>{String(error)}</p>}
/>

{/* truthy gate */}
<SuspenseControlConsumer control={$flag} fallback={<p>Loading…</p>}>
  <p>Feature enabled</p>
</SuspenseControlConsumer>

{/* primitive display */}
<SuspenseControlConsumer control={$total} fallback="…" />
```

### `<SuspenseControlsConsumer>`

Multi-control `SuspenseControlConsumer`: suspends until all are ready.

| Prop | Type | Description |
|---|---|---|
| `controls` | `ReadonlyAsyncControl[]` | The async controls. |
| `render` | `(...values) => ReactNode` | Positional values. |
| `fallback` | `ReactNode` | Shown while loading. |
| `renderIfError?` | render fn, `ReactNode`, or `true` | Render on any error. |
| `container?` | `ContainerComponent` | Wraps content/fallback when non-empty. |

---

## Utils

### `$never`

An async control stuck **loading forever** (value `undefined`, never settles, writes are no-ops). A placeholder where a control is expected but not yet available.

```jsx
{/* $user may be undefined until selected - $never keeps the fallback shown */}
<SuspenseControlConsumer
  control={$user || $never}
  fallback={<p>Loading…</p>}
  render={(user) => <h2>{user.name}</h2>}
/>
```

### `isAggregateControlError(err)`

Type guard for `AggregateControlError` - the error of a derived/bound control. Its `.errors` is **positional** - one slot per source in order, the last slot the control's own (mapper) error; error-free slots are `undefined`.

| Parameter | Type | Description |
|---|---|---|
| `err` | `unknown` | Value to test. |

```ts
if (isAggregateControlError(err)) {
  err.errors.forEach((e, i) => e && console.error(i, e));
}
```

### `isSourceUpdate()`

Whether the change being handled right now came from **somewhere else** rather than from a `setValue`. Only meaningful inside a listener; `false` anywhere else.

| The change came from | Reads as the source |
|---|---|
| a loader handing a value over - the first one and every one after it, a poll's included | yes |
| a derived control recomputing because its sources moved | yes |
| route params, and the routes' matched state, following a back/forward | yes |
| a bound control whose target or key moved for any of the above | yes |
| an external storage the control is backed by, written in another tab | yes |
| the DOM ones - `$online`, `$pageVisible`, `$windowSize`, `mediaQuery` | yes |
| `setValue`, `replaceValue`, `invalidate`, `navigate`, a `Link` | no |

Mainly for submit-on-change: a reload that answers with values the server normalized must reach the inputs without being taken for an edit and submitted again.

```ts
const $form = createAsyncDerivedControl($server, (data) => ({ ...data }));

watchValue($form, (values) => {
  // the reload after a save updates the fields, it doesn't save again
  if (!isSourceUpdate()) {
    save(values).then(() => invalidate($server));
  }
});
```

[`watchValues`](#watchvaluescontrols-callback-immediate-withempty) answers once for the whole tuple, so a flush carrying both a load and an edit reads as the source's.

An async control with no `load` that is fed by an outside `setValue` reads as an edit - the loader is the only origin the library can see. Move such a source into `load` if its values should count as the source's.

---

## Registry

### `createRegistry(create, initArg?, options?)`

A **keyed collection** of controls - one control per distinct key tuple, created and cached lazily on first access.

| Parameter | Type | Description |
|---|---|---|
| `create` | `createControl`, `createPrimitiveControl`, or `createAsyncControl` | The control constructor. |
| `initArg?` | constructor's arg | For async, an `AsyncControlOptions` (its `initialValue` and a loader's `fetch` receive the item's keys); otherwise a default value or `(...keys) => value`. |
| `options?` | `RegistryOptions` | See below. |

**`RegistryOptions`**

| Field | Type | Description |
|---|---|---|
| `externalStorage?` | `SyncExternalStorage` | External storage backing each item's value (receives the item's keys): any storage with sync reads; persisting via [`getPersistStorage`](#getpersiststorageoptions) is one use of it. |
| `keepPrev?` | `boolean` or `boolean[]` | For bound controls: keep showing the previous value while a re-targeted item loads, instead of blanking to `undefined`. An array decides per key: e.g. `[false, true]` keeps the value on the second key's changes but blanks on the first's; when several keys change at once, every changed key must allow keeping. The held value is replaced once the item produces one. |
| `suppressError?` | `boolean` | For bound controls: swallow an error while there is a previous value to show; it surfaces only when there's nothing to hold. On re-targets it applies only where `keepPrev` holds. |

```ts
// async controls
const userRegistry = createRegistry(
  createAsyncControl,
  requestLoader((id: number) => fetch(`/api/users/${id}`).then((r) => r.json())),
  { keepPrev: true } // bound controls keep the last user while the next one loads
);

// sync controls
const draftRegistry = createRegistry(createControl, (chatId: string) => '');

// primitive controls
const expandedRegistry = createRegistry(createPrimitiveControl, (sectionId: string) => false);
```

**Registry methods**

| Method | Returns | Description |
|---|---|---|
| `get(...keys)` | the item | The control for the keys, created on first access. Keys compared structurally (objects/arrays allowed). |
| `bind(...keys)` | a bound control | Like `get`, but keys may be **controls**; re-targets to the item under their current values when a key control changes, aggregating key-control errors with the item's own. `keepPrev` controls what it shows while re-targeting. |
| `invalidate(...keys)` | `void` | Reset items under the keys or a key prefix (async registries only). |
| `delete(...keys)` | `boolean` | Remove an item (doesn't reset the control itself). |
| `clear()` | `void` | Remove all items. |

```ts
const $user = userRegistry.get(42);

const $selectedId = createPrimitiveControl(42);
const $selectedUser = userRegistry.bind($selectedId);   // retargets when $selectedId changes

userRegistry.invalidate(42);
```

---

## Loaders

A loader builds the `load` option for an async control / async registry.

### `requestLoader(fetch, options?, scheduler?)`

One fetch per (re)load.

| Parameter | Type | Description |
|---|---|---|
| `fetch` | `(...keys) => Promise<T>` | Called with the control's registry keys (none for a standalone control); result/rejection is committed. |
| `options?` | `AsyncControlOptions` (without `load`/`isLoaded`) | Extra options to merge (`reloadIfStale`, `loadingTimeout`, …). |
| `scheduler?` | `Scheduler` | Batches result commits. |

```ts
const $products = createAsyncControl(
  requestLoader(() => fetch('/api/products').then((r) => r.json()))
);
```

### `pollLoader(fetch, options, scheduler?)`

Re-fetches on an interval until the result is loaded. Returns `AsyncControlOptions` plus `actions`.

| Parameter | Type | Description |
|---|---|---|
| `fetch` | `(...keys) => Promise<T>` | Called with the control's keys. |
| `options` | `PollOptions` | See below. |
| `scheduler?` | `Scheduler` | Batches result commits. |

**`PollOptions`**

| Field | Type | Description |
|---|---|---|
| `interval` | `number` or `(value) => number` | **Required.** Delay between polls (number only when `syncedKeysCount` is set). |
| `isLoaded` | `(value, prevValue, attempt) => boolean` | **Required.** When `true`, polling stops. |
| `initialValue?` | `T` or `(...keys) => T` | Initial value. |
| `syncedKeysCount?` | `number` | Trailing keys whose controls poll in sync (share one clock); omit for independent polling. |
| `isolatedLanes?` | `boolean` | Each synced group commits on its own lane. |
| `reloadIfStale?` / `reloadOnFocus?` / `loadingTimeout?` / … | | Async options, as in `AsyncControlOptions`. |

**`actions`**

| Method | Description |
|---|---|
| `pause(...keys)` | Pause polling under the keys (leading group keys when `syncedKeysCount` is set, full keys otherwise). |
| `resume(...keys)` | Resume polling under the keys. |
| `reset(...keys)` | Drop the pending interval and refetch - immediately when nothing is in flight, otherwise once the outstanding polls settle. A no-op if no interval is pending. |

```ts
const poll = pollLoader(
  (id: number) => fetch(`/api/jobs/${id}`).then((r) => r.json()),
  { interval: 5000, isLoaded: (job) => job.done }
);
const jobRegistry = createRegistry(createAsyncControl, poll);
poll.actions.pause(42);
```

---

## Persistence

### `getPersistStorage(options)`

Builds a `SyncExternalStorage` to pass as a control's second argument. Returns `undefined` when the storage is unavailable (control stays non-persistent).

| Option | Type | Description |
|---|---|---|
| `name` | `string` | Key the value is stored under (registry keys appended). |
| `storage` | `PersistStorage` or `undefined` | The storage to read/write: [`safeLocalStorage`](#safelocalstorage), [`safeSessionStorage`](#safesessionstorage), or a custom `PersistStorage`. |
| `isValid?` | `(value) => boolean` | Validates a stored value on read; invalid → treated as absent. |
| `converter?` | `{ parse, stringify }` | Serialize to/from string. Defaults to `JSON`. |
| `observable?` | `boolean` | If `true` (and supported), pick up external changes (e.g. another tab). |

```ts
const $theme = createControl(
  'light',
  getPersistStorage({ name: 'theme', storage: safeLocalStorage, observable: true })
);
```

### `safeLocalStorage`

A `localStorage`-backed storage (changes observable across tabs), or `undefined` if `localStorage` is unavailable.

### `safeSessionStorage`

A `sessionStorage`-backed storage (observable within browsing contexts sharing the session), or `undefined` if unavailable.

---

## DOM

Ready-made controls bound to browser state - import and read, no setup. Safe to import on the server (default values, no listeners attached).

They're readonly, and what they follow is nobody's write, so [`isSourceUpdate()`](#issourceupdate) is `true` in their listeners - going offline included.

### `mediaQuery(query)`

Returns a boolean control tracking whether the media `query` matches, kept in sync with [`matchMedia`](https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia). Created once per query and reused after - safe to call inline.

| Parameter | Type | Description |
|---|---|---|
| `query` | `string` | A media query string (as passed to [`matchMedia`](https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia)). |

```tsx
import mediaQuery from 'controlla/dom/mediaQuery';
import useValue from 'controlla/core/useValue';

const Nav = () => {
  const isMobile = useValue(mediaQuery('(max-width: 600px)'));
  return <nav className={isMobile ? 'drawer' : 'tabs'} />;
};
```

### `$online`
An **async control** of connectivity - `true` while online, `undefined` while offline. Since offline means "not ready", the async tooling just works - [`toPromise`](#topromisecontrol)`($online)` waits for reconnection, [`useSuspenseValue`](#usesuspensevaluecontrol-safe)`($online)` suspends a component while offline.

```ts
await toPromise($online);   // wait until back online, then retry
```

### `$pageVisible`
A `boolean` control - `true` while the tab is visible, `false` while hidden.

### `$windowSize`
A `{ width, height }` control of the window's inner size, kept in sync with `resize` and `orientationchange` (committed once per animation frame). `width` and `height` are nested controls - subscribe to one without re-rendering on the other.

```tsx
import $online from 'controlla/dom/online';
import $windowSize from 'controlla/dom/windowSize';
import useValue from 'controlla/core/useValue';

const StatusBar = () => {
  const isOnline = useValue($online);
  const width = useValue($windowSize.width);   // re-renders on width, not height
  return <span>{isOnline ? 'online' : 'offline'} · {width}px</span>;
};
```

---

## Schedulers

Updates batch per scheduler (microtask by default). Pass one wherever a `scheduler` is accepted (`setValue`, `invalidate`, `batch`, loaders, …).

A `Scheduler` is just `(cb: () => void) => any` - it receives a flush callback and decides when to run it. So **any** such function works, not only the factories below - pass `requestAnimationFrame`, `queueMicrotask`, `requestIdleCallback`, React's `startTransition`, or `(cb) => setTimeout(cb, ms)` directly. The factories add state (a `.flush()` handle, coalescing) on top.

```ts
import { startTransition } from 'react';

setValue($filter, value, requestAnimationFrame);          // commit before next paint
setValue($filter, value, startTransition);                // commit as a React transition
setValue($filter, value, (cb) => setTimeout(cb, 200));    // commit after 200ms
```

### `batch(callback, scheduler?)`

Runs `callback` as part of the scheduler's flush. Anything inside it (control writes **and** external side-effects like React `setState`) lands in the same flush, so they coalesce into a **single re-render**. If already inside a flush, runs immediately and joins it.

Coalescing only happens between `batch` and writes on the **same scheduler** (same flush). They share a flush by default (both microtask); pass the same custom `scheduler` to both to coalesce on it.

| Parameter | Type | Description |
|---|---|---|
| `callback` | `() => void` | Run within the flush: its control writes and any `setState` share that flush. |
| `scheduler?` | `Scheduler` | Schedules the flush (microtask by default). |

```tsx
// inside a component
const [open, setOpen] = useState(false);

const select = (id: number) => {
  setValue($selectedId, id);       // control write
  batch(() => setOpen(false));     // this setState joins the same flush → one re-render
};
```

### `createManualScheduler()`

A scheduler that commits **only** when `.flush()` is called.

**Returns**: a `Scheduler` with `flush(): boolean` (runs the pending commit; `true` if there was one).

Called from inside a listener - that is, while another scheduler is already committing - it runs right after that one finishes instead of in the middle of it. `true` still means there was something pending.

```ts
// stage several filter edits, apply them on "Search" as one update
const scheduler = createManualScheduler();

setValue($filters.minPrice, 10, scheduler);
setValue($filters.maxPrice, 50, scheduler);
setValue($filters.inStock, true, scheduler);

const onSearch = () => scheduler.flush();   // one commit → one re-render
```

### `createThrottleScheduler(ms)`

Delays the flush by `ms`, batching all updates in the window into one commit.

| Parameter | Type | Description |
|---|---|---|
| `ms` | `number` | Window in milliseconds. |

**Returns**: a `Scheduler` with `flush(): boolean` (force the pending commit now).

```ts
const throttle = createThrottleScheduler(100);

window.addEventListener('pointermove', (e) => {
  setValue($cursor, { x: e.clientX, y: e.clientY }, throttle);   // ≤1 commit per 100ms
});
```

### `createDebounceScheduler(ms)`

Delays the flush until `ms` of quiet - each update resets the timer, so it commits once updates stop.

| Parameter | Type | Description |
|---|---|---|
| `ms` | `number` | Quiet period in milliseconds. |

**Returns**: a `Scheduler` with `flush(): boolean`.

```ts
const debounce = createDebounceScheduler(300);
setValue($search, value, debounce);   // commits 300ms after the last change
```

---

## Forms

Validation, submit orchestration and dirty tracking over controls you already have. The form **doesn't own the values**: `useForm` takes a control, and reading and writing stay what they are everywhere else - `useValue`, `setValue`, granular per-path re-renders.

Three separate things, each mountable on its own:

| | What it is | Mounted as |
|---|---|---|
| **Fields** | the wiring between a control and an element - `ref`, `name`, `onBlur`, and whether it holds an error | `useNativeField` / `useField`, or `NativeField` / `Field` |
| **Validators** | the rules, each owning the error it wrote as a control of its own | `useValidator` / `usePathValidator`, or `Validator` / `PathValidator` |
| **The form** | the sweep, the submit, the baseline, the focus | `useForm` + `FormProvider` |

A field validates nothing and a validator renders nothing, so a rule can cover controls no field is mounted on, several rules can cover one field, and both un-register by disappearing.

### `useForm(control, options)`

Creates the form handle. Created once and kept for the component's life; `options` are re-read every render.

| Parameter | Type | Description |
|---|---|---|
| `control` | `Control` | What gets submitted, reset and baselined. |
| `options.submit` | `(values, changed) => void \| Promise<void>` | Runs once every registered validator passed. `changed` is the dot paths differing from the baseline - what a `PATCH` would send. |
| `options.submitFailed?` | `() => void \| Promise<void>` | Runs instead, after the first invalid field is focused. What failed is in the error controls the validators returned. |
| `options.validateOn?` | `'submit' \| 'change' \| 'blur'` | Default trigger for the validators under it (default: `'submit'`). |

**Returns**: a `FormState` - `$isSubmitting`, `$isValidating`, `$isValid`, `$isDirty`, `submit(event?)`, `validate()`, `reset(control?, value?)`, `focus(control)`.

`$isValid` is every mounted validator holding no error - one that never ran counts as valid. `focus(control)` focuses that field's element and returns whether there was one; a field is focusable once it's mounted and passed its `ref` on. A failed `submit` focuses the first invalid field in the *document*, and for an error that marks no field of its own (an array rule, a group rule) the first field under what it validates.

The **baseline** is taken when the form is created, and moves to whatever a `reset` wrote. `$isDirty` and `changed` are both measured against it. A submit leaves it alone - `reset(control, values)` from the handler is what makes what was sent the new baseline, so an autosaving form gets what moved since the *previous* submit:

```ts
const form = useForm($values, {
  submit: async (values, changed) => {
    await api.save(values, changed);

    form.reset($values, values);   // an edit made while it was in flight stays dirty
  },
});
```

A `reset` also takes the errors of what it restored with it. A rule watching more than what was reset keeps its own - it holds an error, so it is watching, and the restored value is what runs it again: what it reports is about that value, not about the one on its way out.

Over an async control the baseline is the **first** value a load hands over - the one the form waited for, so waiting for data is not an edit and the fields start clean. Every value after it is a value like any other: a reload overwrites what is being edited and the form reads as dirty against what it first got. Nothing rebaselines it for you, because nothing but the caller knows whether what came back should replace the edits - `reset(control, values)` from wherever the reload was asked for is what says so:

```ts
await api.save(values);

form.reset($values, await invalidate($values, true));
```

A form over a control that reloads underneath it (`reloadOnFocus`, `reloadIfStale`, a poll) is worth gating on `selectLoading` all the same: nothing stops a reloading control from overwriting an edit, since it still holds its value and its fields still write.

### `<FormProvider form>`

Exposes the form to the fields, validators and `useFieldState`/`useFormState` calls under it. Outside any provider a field is still wired to its control and a rule still validates - they just have no form to meet in, so nothing is swept, nothing is marked (`isError` stays `false`), and the error is only what its own control holds.

### Errors

A validator hands back the error as a **control**, so the shape is yours - a message, or the props of whatever renders one, read per part:

```tsx
const $error = useValidator($values.email, (email) =>
  email.includes('@') ? undefined : 'invalid email');

<ControlConsumer control={$error} />;
```

`undefined` is passing; anything else is failing. A field never carries the error itself - it only knows **that** it has one, since several validators can cover it:

```tsx
const { isError } = useField($values.email);          // in the wiring
const { $isError } = useFieldState($values.email);    // or on its own
```

An error belongs to **one control** and goes nowhere else - not down to the fields under it, not up to the ones above. `useValidator` reports for the controls it was given; `usePathValidator` reports for whichever controls its rule names.

A `useValidator` error is also writable, so a rejection coming back from the server can be put straight on the field - and it revalidates like any other:

```ts
setValue($error, 'already taken');
```

Whatever the trigger, an error revalidates live until it clears. Which is why the next run of that rule overwrites what you wrote: to keep a server error until *you* clear it, give the rule a control to read it from. A rule watches every control it is given, and only answers for the slots it fills:

```tsx
const $rejected = useControl<string | undefined>(undefined);   // yours to clear

const [$emailError] = useValidator(
  [$values.email, $rejected],
  ([email, rejected]) => [rejected ?? (email.includes('@') ? undefined : 'invalid email')],
  'change'
);
```

Writing `$rejected` re-runs the rule, and `$rejected` itself is never marked - it carries no slot of its own. A rule left on `'submit'` won't see the write until the next sweep, so call `form.validate()` after the response, or watch it on `'change'` like above.

A validator must not throw: catch what can fail and return an error instead (`'could not check right now'`). An exception is reported rather than shown - through `reportError` from a change run, out of the promise from `submit()`/`validate()` - and nothing about the form says what went wrong.

### `useValidator(control, validate, validateOn?)` / `<Validator>`

The rule for one control, or for a tuple of them.

| Parameter | Type | Description |
|---|---|---|
| `control` \| `controls` | `Control` \| `Control[]` | What it validates. A tuple gets every value and answers per control. |
| `validate` | `(value) => E \| undefined \| Promise<…>` | The error, or `undefined`. For a tuple: one slot per control. |
| `validateOn?` | `'submit' \| 'change' \| 'blur'` | Overrides the form's trigger. Any of a tuple's controls blurring is enough for `'blur'`. |

**Returns**: the error control - one per slot for the tuple form. `validate` is read every render, so closing over props is safe.

```tsx
// the error lands on the field that should show it, not on both
const [, $repeatError] = useValidator(
  [$values.password, $values.repeat],
  ([password, repeat]) =>
    password === repeat ? undefined : [undefined, 'passwords differ']
);
```

The component form takes the same three as props and hands the error control(s) to `render`, which is optional - leave it out when only `isError` matters and it renders nothing. It's also how a rule that only applies sometimes is mounted, since a hook can't be called conditionally:

```tsx
{required && (
  <Validator
    control={$values.email}
    validate={(email) => (email ? undefined : 'required')}
    render={($error) => <ControlConsumer control={$error} />}
  />
)}
```

### `usePathValidator(control, validate, validateOn?)` / `<PathValidator>`

The rule over a subtree that reports the errors of the fields **under** it - which rows duplicate, which of two dates is the wrong one. `validate` answers with one entry per control that failed:

```tsx
const errorOf = usePathValidator($values.emails, (emails) => {
  const seen = new Map<string, number>();

  const errors: ControlErrors<string> = [];

  for (let i = 0; i < emails.length; i++) {
    const at = seen.get(emails[i]);

    if (at !== undefined) {
      errors.push([$values.emails[at], 'duplicate']);

      errors.push([$values.emails[i], 'duplicate']);
    } else {
      seen.set(emails[i], i);
    }
  }

  return errors;
});

<ControlConsumer control={errorOf($values.emails[index])} />;
```

**Returns**: `errorOf(control)` - that control's error as a control of its own, `undefined` while it has none. The control is made the first time it's asked for and kept, so a field whose error nothing renders allocates nothing. Targets are controls, not strings, so a rename follows and there's nothing to parse.

Nothing to report is `undefined` or no entries at all. The error belongs to the control it was reported for and to nothing else - neither the fields under it nor the ones above turn red with it, so report those too when they should be. An error that belongs to the whole thing is `useValidator` on it.

The `ControlErrors<E>` annotation is only needed for an accumulator like the one above - an array literal is inferred from the call. Each pair is inferred on its own, so a rule that answers with a different error for a different kind of control keeps them apart: `errorOf` reads as one signature per pair, and asking about a control nothing was paired with doesn't compile. Pairs of their own shapes are `ControlError<typeof $control, E>[]` rather than `ControlErrors<E>`.

The component form is the same rule, mountable with the subtree it belongs to, and hands `errorOf` to `render`:

```tsx
<PathValidator
  control={$values.dates}
  validate={({ from, to }) =>
    from <= to ? undefined : [[$values.dates.to, 'ends before it starts']]}
  render={(errorOf) => <ControlConsumer control={errorOf($values.dates.to)} />}
/>
```

### `useNativeField(control, options)` / `<NativeField>`

A field the **element itself owns**: read on every `input`/`change`, written back only when the control moves elsewhere (a `reset`, an async fill). Typing re-renders nothing, and neither does an error appearing - `aria-invalid` and `aria-describedby` land on the element directly.

| Option | Type | Description |
|---|---|---|
| `type` | `NativeFieldType` | What the field *is*, not which element renders it - see below. |
| `parse?` / `format?` | `(value) => …` | Converts on the way to the control and back. |
| `errorId?` / `describedBy?` | `string` | Composed into the element's `aria-describedby`. |

**Returns**: `name`, `ref`, `onBlur` and the attributes the type implies - spread them onto your `input`, `select` or `textarea`. Everything but `control` is read once.

The element writes on every `input`/`change`, with nothing in between: what the validators read is always what was typed. To have readers of the control settle instead, debounce on their side - a `createDebounceScheduler` on the write that feeds them, or a derived control they watch.

`type` covers `text`, `search`, `url`, `tel`, `password`, `color`, `hidden`, `email`, `numeric`, `decimal`, `range`, `checkbox`, `radio`, `file`, `date`, `month`, `week`, `time`, `datetime-local`, `textarea`, `select`, `multiselect`. The value type follows from it (`checkbox` → `boolean`, `numeric` → `number`, `file` → `FileList | null`, `multiselect` → `string[]`), and a control that can't hold everything the field may write is a compile error. `numeric`/`decimal`/`email` render as `text` with an `inputmode`: the native types have no text cursor to restore a caret in, and run validation of their own before yours.

```tsx
const amount = useNativeField($values.amount, {
  type: 'decimal',
  errorId: 'amount-error',
});

return <input {...amount} />;
```

The component form takes the same options as props, and hands `render` the wiring plus the field's state - for a field mounted inline, in a list, or conditionally:

```tsx
<NativeField
  type='text'
  control={$values.tags[index]}
  render={(props, { $isError }) => (
    <input {...props} className={useValue($isError) ? 'invalid' : undefined} />
  )}
/>
```

The same props can go on several elements - a radio group, one field shown twice - on React 19. Below that, one element per field.

### `useField(control)` / `<Field>`

The wiring for a component that owns its own rendering - a date picker, a combobox, anything taking `value`/`onChange`.

**Returns**: `name`, `ref`, `onBlur`, plus `value`, `onChange(value)` and `isError`.

Reading the value means re-rendering on every keystroke, which a component taking a `value` prop makes unavoidable - `Field` is this hook as a component, so that re-render stops there instead of taking the section with it. For a native element, `useNativeField` re-renders nothing at all.

```tsx
<Field
  control={$values.country}
  render={({ value, onChange, isError, ...rest }) => (
    <Select {...rest} value={value} onChange={onChange} error={isError} />
  )}
/>
```

`onChange` takes the value itself, not an event, and writes straight through - a delayed write with a controlled input freezes what's typed.

### `useFieldArray(control)`

Gives an array control **a key per item** and the operations to restructure it. A key follows its item through an insert or a remove instead of belonging to the index, so rows keep their identity - and their DOM state - as the array moves under them.

**Returns**: `$keys` plus the operations below.

| Method | Description |
|---|---|
| `append(value)` / `prepend(value)` | Adds one item at either end. |
| `insert(index, value)` | Adds one at `index`. Past the end appends. |
| `appendMany(values)` / `prependMany(values)` / `insertMany(index, values)` | The same for a whole array - a paste, a multi-select, a fetched page. One call, one commit. |
| `remove(index, count?)` | Drops `count` items from `index` on (default: one). |
| `removeMany(indexes)` | Drops the items at `indexes`, which need not be neighbours - in any order, duplicates ignored. Not `remove` in a loop: each of those shifts what follows it. |
| `replace(values)` | Swaps the whole array out. Every item gets a new key, so every row remounts. |
| `swap(a, b)` / `move(from, to)` | Reorders, keys included. |

A key is handed out once, from `0`, and never reused. A write from anywhere else (a `reset`, a server fill) keeps the keys of the indexes it kept and gives the tail of a longer array new ones. Calls compose within a flush - each starts from what the last one wrote - so `append` twice appends twice.

What no single item can answer - how many there are, whether two collide - is a validator over the array: `useValidator` for the array's own error, `usePathValidator` for the rows'.

```tsx
const { $keys, append, removeMany } = useFieldArray($values.tags);

useValidator($values.tags, (tags) => (tags.length > 10 ? 'too many' : undefined));

<ControlConsumer
  control={$keys}
  render={(keys) =>
    keys.map((key, index) => <Row key={key} $tag={$values.tags[index]} />)
  }
/>;

<button onClick={() => append('')}>add</button>;
<button onClick={() => removeMany(selectedIndexes)}>remove selected</button>;
```

### `useFieldState(control)`

The state of one field - `$field`, `$isError`, `$isDirty`, `$isValidating` - from anywhere under the form. The field doesn't have to be mounted yet: the entry is created on first access and picks up whatever the mounted validators already hold for it.

```tsx
const { $isError, $isDirty } = useFieldState($values.email);
```

### `useFormState()`

The enclosing form - the same handle `useForm` created, so `$isSubmitting`, `$isValid`, `$isDirty` and `submit` are reachable without threading props down. Throws outside a `FormProvider`.

```tsx
const { $isSubmitting, $isValid } = useFormState();

return <button disabled={useValue($isSubmitting) || !useValue($isValid)}>Save</button>;
```

---

## Router

Routes are a **typed tree**, not URL strings - every dynamic piece of the URL (path params, query, hash) lives in a regular control. Read it with [`useValue`](#usevaluecontrol), write it with [`setValue`](#setvaluecontrol-value-scheduler), and the address bar stays in sync on its own. Navigation targets are built by calling the tree (`navigation.product({ id: '42' })`), so a typo or a missing param is a compile error, not a 404.

### `createRouter(paths)`

Creates the app's router (there's exactly one). It matches the current URL immediately and from then on owns history, scroll restoration and anchor scrolling.

```ts
import createRouter from 'controlla/router/createRouter';

const router = createRouter(paths);
```

- `router.routes` - the typed route tree, where every route is a readonly control of whether it's matched.
- `router.navigation` - target builders, for [`navigate`](#navigateto-replace-ignoreblock-scrolltotop-scrollrestoration) and [`Link`](#link--uselink) below.
- `router.navigationState` - a control reporting how the current entry was reached: `{ action: 'push' | 'replace' | 'pop', delta }`. Mostly for analytics - telling a real navigation apart from a back/forward one.
- `router.navigationBlocker` - see [Blocking navigation](#blocking-navigation).

### `createPath(...path)`

Declares one path of the route tree. Arguments come in order - static string segments and param declarators (`param`, `query`, `oneOf`, `arrayParam`) building up the path, an optional `anchor(...)`, and an optional children record for nested paths.

```ts
import createPath from 'controlla/router/createPath';
import param from 'controlla/router/param';
import withNotFound from 'controlla/router/withNotFound';

const paths = withNotFound({
  home: createPath(),
  product: createPath(
    'product',
    param({ id: { parse: Number, stringify: String } }),
    { reviews: createPath('reviews') }              // /product/42/reviews
  ),
});
```

### `createAsyncPath(source)`

Like `createPath`, but for a path whose params need data that isn't available synchronously - a lookup dictionary, a feature config, and so on. Pass the `source` control first - every `parse`, `stringify`, `isValid` and default of the path's params then receives the source's current value as an extra argument. A sync control works as a source too - it counts as "ready" once its value isn't `undefined`.

The route matches immediately, but its params control is **async** - `undefined` until `source` is ready, the parsed params once it resolves. If `source` changes later, the same URL strings are re-parsed against the new value, and when that yields different params, the URL is rewritten in place to match.

A parse failure (a bad value with no `fallbackValue`) doesn't behave like `createPath`'s "route just doesn't match" - the route still matches, but the params control commits an error instead of a value, readable with `selectError`/`isAggregateControlError`.

```ts
import createAsyncPath from 'controlla/router/createAsyncPath';

// /product/laptops - the slug is resolved through an async category dictionary
const paths = {
  product: createAsyncPath($categories)(
    'product',
    param({
      category: {
        parse: (slug, categories) => categories.bySlug[slug],
        stringify: (category) => category.slug,
      },
    })
  ),
};
```

### `param(options)`

Declares a dynamic path segment. Takes exactly one `{ name: options }` pair - the parsed value lands in the route's params control under that name.

`options` is either a **boolean** or a **`ParamOptions` object**:

| `options` | Meaning |
|---|---|
| `false` | A required plain string. |
| `true` | An optional plain string - the URL may omit the segment. |
| `ParamOptions` object | Typed parsing, validation and defaults, described below. |

| `ParamOptions` field | Type | Description |
|---|---|---|
| `parse?` | `(raw) => T` | Converts the URL string to the typed value. |
| `stringify?` | `(value) => string` | Converts the typed value back to a URL string. Return `''` to leave the param out of the URL entirely; `undefined` and `''` values skip it without calling it at all. |
| `isValid?` | `(raw) => boolean` | Rejects garbage input - without a `fallbackValue`, the route just doesn't match. |
| `fallbackValue?` | `T` | Used in place of invalid raw input, instead of failing the match. |
| `optional?` | `boolean` | Lets the URL omit the segment. |
| `defaultValue?` | `T` | Stands in for a missing value - on parse, and when writing the URL too. The segment always shows this value until something else is explicitly set; there's no way to clear it back to "absent". |
| `initialValue?` | `T` | Applied once, on the session's first load, then written into the URL like a real value from then on - unlike `defaultValue`, it can be cleared normally afterward. |

```ts
createPath('product', param({ id: false }));                               // required string
createPath('product', param({ id: { parse: Number, stringify: String } })); // typed
```

`isValid`/`fallbackValue` only guard the URL → params direction. Building a target (`navigation.product({ id })`) skips them entirely - TypeScript's types are what keep the value you pass valid there, so `stringify` trusts it as-is.

### `query(options)`

Declares the path's query params - place it after the path segments. Takes a `{ name: options }` record - each value follows the same boolean-or-`ParamOptions` shape as [`param`](#paramoptions). Absent optional params are `undefined` in the params control, and `undefined` values are dropped from the URL.

```ts
import query from 'controlla/router/query';

createPath('catalog', query({ sort: true, page: { parse: Number, optional: true } }));
```

### `oneOf(options)`

Declares a dynamic path segment restricted to a fixed set of string variants - the route matches only when the segment is one of them, and the param is typed as their union.

| Field | Type | Description |
|---|---|---|
| `variants` | `string[]` | The allowed values; the param's type is their union. |
| `optional?` | `boolean` | Lets the URL omit the segment. |
| `defaultValue?` | one of `variants` | Same as `param`'s `defaultValue` - stands in for a missing value, including in the URL. |

```ts
import oneOf from 'controlla/router/oneOf';

createPath('orders', oneOf({ status: { variants: ['active', 'done'] } }));
```

### `arrayParam(options)`

Declares a dynamic path segment whose value is a `/`-joined array of strings, e.g. `/tags/red/blue/green`. Unlike `param` and `query`, it's always required - there's no optional variant.

`options` is either `false` (the raw `string[]`) or an object with `parse` / `stringify` for a typed array. Stringifying an empty array throws.

```ts
import arrayParam from 'controlla/router/arrayParam';

createPath('search', arrayParam({ tags: false }));   // /search/red/blue/green
```

### `createRouterView(routes)`

Builds the component that renders the matched page inside its layouts. On navigation **only the slots whose component changed re-render** - switching pages under a shared layout never re-renders the layout.

```tsx
import createRouterView from 'controlla/router/createRouterView';
import NOT_FOUND from 'controlla/router/NOT_FOUND';

const RouterView = createRouterView([
  [router.routes.home, HomePage],
  [MainLayout, [
    [router.routes.product, ProductPage],
    [router.routes.product.reviews, ReviewsPage],
    [router.routes.catalog, CatalogPage],
  ]],
  [router.routes[NOT_FOUND], NotFoundPage],
]);

createRoot(document.getElementById('root')!).render(<RouterView />);
```

### `Link` / `useLink`

`useLink` is a headless hook returning `href`, `onClick` and `isMatched`; `Link` is a thin render-prop wrapper over it. `isMatched` is computed (and subscribed) only with the `trackMatch` option - `true` tracks whether the route is matched, `'exact'` also compares the params and anchor the link points at.

```tsx
import Link from 'controlla/router/Link';

<Link
  to={router.navigation.catalog({ sort: 'price' })}
  trackMatch
  render={({ href, onClick, isMatched }) => (
    <a href={href} onClick={onClick} className={isMatched ? 'active' : ''}>
      Catalog
    </a>
  )}
/>
```

### `navigate(to, replace?, ignoreBlock?, scrollToTop?, scrollRestoration?)`

Programmatic navigation - pushes a history entry, or replaces it with `replace`. `<Redirect to={...} />` does the same on mount (replace by default).

```ts
import navigate from 'controlla/router/navigate';

navigate(router.navigation.product({ id: 42 }));            // → /product/42
navigate(router.navigation.product({ id: 42 }).reviews());  // → /product/42/reviews
navigate(router.navigation.product().reviews());            // already on product/42 - same id, add reviews
navigate(router.navigation.home(), true);                   // replace
```

Calling a chained segment with no arguments, like `.product()` above, keeps that route's params as currently set instead of changing them (it only works while that route is already matched - a required param can't be left unspecified otherwise). The same "leave as currently set" rule applies to the trailing anchor argument - pass `undefined`, or leave it off, to keep the hash untouched.

### Route params are controls

`selectParams(route)` returns the route's params as a regular control, shaped like whatever `param`/`query` declared - read it with [`useValue`](#usevaluecontrol), write it with [`setValue`](#setvaluecontrol-value-scheduler)/[`replaceValue`](#replacevaluecontrol-value-scheduler), and the URL follows automatically. Components subscribe to exactly the field they read.

```tsx
import selectParams from 'controlla/router/selectParams';

const $catalog = selectParams(router.routes.catalog);

const SortSelect = () => {
  const sort = useValue($catalog.sort);            // re-renders only on sort change

  return (
    <select
      value={sort ?? 'default'}
      onChange={(e) => replaceValue($catalog.sort, e.target.value)}
    />
  );
};

setValue($catalog, { sort: 'price', page: 2 });    // whole object, pushes an entry
```

[`setValue`](#setvaluecontrol-value-scheduler)/[`replaceValue`](#replacevaluecontrol-value-scheduler) throw if the route isn't matched. If a `navigate()` also happens in the same tick, the write is dropped instead of applying - the navigation wins.

### `replaceValue(control, value, scheduler?)`

Writes to a router params control like `setValue`, but replaces the current history entry instead of pushing a new one (only if every write in the flush was a replacement). Router-only - on any non-router control it does nothing special, identical to `setValue`, so use `setValue` there.

```ts
replaceValue(selectParams(router.routes.catalog), { sort: 'price' }); // no new history entry
```

### Anchors

`anchor(getOptions?)` gives a route a typed anchor control (`selectAnchor`), stored in the URL as its hash. Writing to it, with [`setValue`](#setvaluecontrol-value-scheduler)/[`replaceValue`](#replacevaluecontrol-value-scheduler) or a navigation's anchor argument, scrolls to the element registered under that id with `registerAnchor(route, id)`. If the element isn't mounted yet (the page is still loading), the scroll retries, instantly, once it mounts, unless the user has scrolled in the meantime. An empty string clears the URL's hash without scrolling; leaving it `undefined` (no argument) leaves it untouched.

`getOptions` sets the scroll options (`behavior`, `topOffset`/`leftOffset`, …): an object, or a resolver `(offsetEl, id) => options` called at scroll time with the offset element (see [`registerAnchorOffset`](#registeranchoroffsetroute)) and the target id — so the offset can vary per section.

```tsx
import anchor from 'controlla/router/anchor';
import registerAnchor from 'controlla/router/registerAnchor';
import selectAnchor from 'controlla/router/selectAnchor';

const paths = {
  docs: createPath('docs', anchor<'intro' | 'api'>()),
};

const DocsPage = () => (
  <>
    <section {...registerAnchor(router.routes.docs, 'intro')}>…</section>
    <section {...registerAnchor(router.routes.docs, 'api')}>…</section>
  </>
);

const $section = selectAnchor(router.routes.docs);  // Control<'intro' | 'api' | ''>

navigate(router.navigation.docs('api'));            // navigate straight to a section
setValue($section, 'intro');                        // or just set it
```

### `registerAnchorOffset(route)`

Registers the element the scroll math should account for - a sticky header, say - so `anchor()`'s scroll lands below it instead of underneath. Returns a cached ref, safe to call during render.

```tsx
import registerAnchorOffset from 'controlla/router/registerAnchorOffset';

<header ref={registerAnchorOffset(router.routes.docs)} />
```

### `selectRegisteredAnchors(route)`

A reactive set of the ids currently mounted, for building a section nav that only shows what's on the page - `true` per mounted id, `undefined` when not mounted. With [`trackScroll`](#trackscrollanchor), the currently active id is `'active'` instead of `true`.

```tsx
import selectRegisteredAnchors from 'controlla/router/selectRegisteredAnchors';

const $registered = selectRegisteredAnchors(router.routes.docs);

const SectionNav = () => (
  <nav>
    {(['intro', 'api'] as const).map((id) => {
      const state = useValue($registered[id]);
      return state && (
        <Link
          key={id}
          to={router.navigation.docs(id)}
          render={({ href, onClick }) => (
            <a href={href} onClick={onClick} className={state === 'active' ? 'active' : ''}>
              {id}
            </a>
          )}
        />
      );
    })}
  </nav>
);
```

### `trackScroll(anchor)`

Tracks which registered section is currently on screen - wrap it around `anchor()`'s result and it keeps [`selectRegisteredAnchors`](#selectregisteredanchorsroute) marking that one `'active'` as the user scrolls.

```tsx
import anchor from 'controlla/router/anchor';
import trackScroll from 'controlla/router/trackScroll';

const paths = {
  docs: createPath('docs', trackScroll(anchor<'intro' | 'api'>())),
};

const state = useValue(selectRegisteredAnchors(router.routes.docs).intro); // 'active' | true | undefined
```

### Blocking navigation

Guard unsaved changes - while `navigationBlocker` is enabled, an attempted navigation is parked instead of applied. `isPendingNavigation` is just a control plus `allow()`/`deny()` - it doesn't render anything itself, so build whatever UI you want around it (dialog, toast, inline banner). Tab close is guarded via `beforeunload`. Only the latest attempt is parked - if another navigation is attempted while one is pending, `allow()` resolves that later one and the earlier is dropped.

```tsx
const { navigationBlocker } = router;

useEffect(() => navigationBlocker.enable(), []);   // enable returns disable

const pending = useValue(navigationBlocker.isPendingNavigation);

if (pending) {
  // show your own UI, then resolve it:
  navigationBlocker.isPendingNavigation.allow();
  navigationBlocker.isPendingNavigation.deny();
}
```

### `repairHistory()`

Drops the history entries a third party left behind. Every navigation inside an iframe - a 3DS payment frame, an embedded ad - appends one, and while they're there the back button does nothing for as many presses as were added.

```ts
const repaired = await router.repairHistory();
```

Every navigation repairs the history first, so call this only to fix the back button while staying on the page. Resolves to `false` when there was nothing to drop, or when the current entry is the session's first - that one has nothing in front of it to push from.

The router also handles what you'd expect from the platform - scroll position is restored on back/forward and across refreshes, and the anchor is scrolled on first load.

## Troubleshooting

### `param`/`query` value type breaks when `stringify` is present

A param's value type is inferred from `parse`'s **return**. If you leave `parse`'s argument implicit *and* also pass a `stringify`, TypeScript has to resolve the value type to type both callbacks' implicit arguments before it has inferred it from the return - it falls back to `string`, which then clashes with the real return type:

```ts
param({
  slug: {
    parse(value) {                       // implicit arg + stringify below = broken
      return { id: +value, text: value };
    },
    stringify(value) {
      return value.text;                 // Error: 'text' does not exist on 'string'
    },
  },
});
```

Annotate `parse`'s argument as `string` (it always is). Inference then flows from the return, and `stringify`'s argument is typed automatically - everything stays generic:

```ts
param({
  slug: {
    parse(value: string) {               // <-- the only change
      return { id: +value, text: value };
    },
    stringify(value) {
      return value.text;                 // value is { id: number; text: string }
    },
  },
});
```

The same applies to `query` and `arrayParam`.

### Get named `controlla` import suggestions in VS Code

Every export is reachable two ways: the named barrel (`import { selectParams } from 'controlla'`) and a per-entry default (`import selectParams from 'controlla/router/selectParams'`). Both tree-shake (the package is `sideEffects: false`), but the per-entry default form makes VS Code guess an inconsistent local name for each auto-import. To get clean named-import suggestions, add to `.vscode/settings.json`:

```jsonc
{
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "typescript.preferences.autoImportSpecifierExcludeRegexes": ["^controlla$"]
}
```

(For JS files use the `javascript.preferences.*` equivalents.)
