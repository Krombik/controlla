<h1 align="center">🎮 controlla</h1>

<p align="center">Fine-grained reactive state for React — async, derived, persisted, and keyed, with surgical re-renders.</p>

<p align="center">
  <img alt="npm" src="https://img.shields.io/npm/v/controlla.svg" />
  <img alt="bundle" src="https://img.shields.io/bundlephobia/minzip/controlla.svg" />
  <img alt="types" src="https://img.shields.io/npm/types/controlla.svg" />
  <img alt="license" src="https://img.shields.io/npm/l/controlla.svg" />
</p>

A **control** is a reactive value you read, write, derive from, persist, and subscribe to. Writes notify only the paths that actually changed — no selectors, no context, no re-render storms.

- 🎯 **Fine-grained** — a write touches only the fields that changed; `$user.profile.name` is its own control.
- ⚡ **Built-in async** — loading / ready / error states, Suspense, request & polling loaders.
- 🔗 **Derived & combined** — controls that recompute only when their sources are ready.
- 🗂️ **Keyed registries** — one control per key, created on demand.
- 💾 **Persistence** — `localStorage` / `sessionStorage`, observable across tabs.
- ⏱️ **Batching & scheduling** — microtask by default; throttle, debounce, manual.
- 🌳 **Tree-shakeable & typed** — every export is its own import, no barrel.

```bash
pnpm add controlla
```

```bash
yarn add controlla
```

```bash
npm install --save controlla
```

> Requires React 17 or above.

## Quick start

A control lives **outside React** — no provider, no context. It's a tree of controls: every nested field (`$form.name`, `$form.address.city`) is a control of its own, and a component subscribes to exactly the one it reads. Write a field and **only the components reading that field re-render** — siblings don't:

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

No reducers, no selectors, no memoization — `setValue($form.name, …)` notifies `.name` (and `$form`), nothing else.

Async data is **state too**, not fetch-glue in components. A `createRegistry` of async controls gives you one cached, self-fetching resource per key — fetched on first use, deduped, suspendable, refetchable:

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

> Every export is its own subpath import (`controlla/<domain>/<name>`) — no barrel, fully tree-shakeable. Controls are conventionally named with a leading `$`. The **router** module isn't documented here yet.

---

## Contents

- **Controls** — [`createControl`](#createcontrol--usecontrol), [`createPrimitiveControl`](#createprimitivecontrol--useprimitivecontrol), [`createAsyncControl`](#createasynccontrol--useasynccontrol), [`createDerivedControl`](#createderivedcontrol--usederivedcontrol), [`createAsyncDerivedControl`](#createasyncderivedcontrol--useasyncderivedcontrol)
- **Reading values** — [`getValue`](#getvaluecontrol), [`useValue`](#usevaluecontrol), [`toPromise`](#topromisecontrol), [`useSuspenseValue`](#usesuspensevaluecontrol-safe), [`useSuspenseValues`](#usesuspensevaluescontrols-safe), [`useInfiniteValues`](#useinfinitevaluescontrols)
- **Writing values** — [`setValue`](#setvaluecontrol-value-scheduler), [`invalidate`](#invalidatecontrol-silentorscheduler)
- **Subscribing** — [`watchValue`](#watchvaluecontrol-callback-immediate), [`watchValues`](#watchvaluescontrols-callback-immediate), [`load`](#loadcontrol), [`watchSlowLoading`](#watchslowloadingcontrol-callback)
- **Async status** — [`selectLoading`](#selectloadingcontrol), [`selectReady`](#selectreadycontrol), [`selectError`](#selecterrorcontrol)
- **Components** — [`ControlConsumer`](#controlconsumer), [`ControlsConsumer`](#controlsconsumer), [`InfiniteControlsConsumer`](#infinitecontrolsconsumer), [`Suspense`](#suspense), [`SuspenseControlConsumer`](#suspensecontrolconsumer), [`SuspenseControlsConsumer`](#suspensecontrolsconsumer), [`wrapErrorBoundary`](#wraperrorboundaryboundarycomponent)
- **Utils** — [`$pending`](#pending), [`isAggregateControlError`](#isaggregatecontrolerrorerr)
- **Registry** — [`createRegistry`](#createregistrycreate-initarg-options)
- **Loaders** — [`requestLoader`](#requestloaderfetch-options-scheduler), [`pollLoader`](#pollloaderfetch-options-scheduler)
- **Persistence** — [`getPersistStorage`](#getpersiststorageoptions), [`safeLocalStorage`](#safelocalstorage), [`safeSessionStorage`](#safesessionstorage)
- **DOM** — [`mediaQuery`](#mediaqueryquery), [`$online`](#online), [`$pageVisible`](#pagevisible), [`$windowSize`](#windowsize)
- **Schedulers** — [`batch`](#batchcallback-scheduler), [`createManualScheduler`](#createmanualscheduler), [`createThrottleScheduler`](#createthrottleschedulerms), [`createDebounceScheduler`](#createdebounceschedulerms)

---

## Controls

Each creator has a `use*` twin (`controlla/core/use*`) that does the same but binds the control to a React component — created on first render, the same instance afterwards. Pass a factory (`() => …`) to build it once when the argument is expensive.

### `createControl` / `useControl`

A control with **granular reactivity**: nested fields are reachable as controls of their own via property access, and a change notifies only the paths it actually touched.

```ts
createControl(value?, externalStorage?)
useControl(value?, externalStorage?)
```

| Parameter | Type | Description |
|---|---|---|
| `value?` | `T` or `() => T` | Initial value, or a lazy initializer. |
| `externalStorage?` | `SyncExternalStorage` | External storage backing the value: the control starts from the stored value, writes changes back and, if the storage is observable, picks up external changes. Any storage with sync reads works — e.g. one from [`getPersistStorage`](#getpersiststorageoptions). |

```ts
const $user = createControl({ profile: { name: 'John', age: 30 } });   // value
const $draft = createControl(() => ({ id: crypto.randomUUID(), text: '' }));   // lazy initializer
const $note = createControl<string>();                                 // empty (undefined)

const $name = $user.profile.name;     // nested field = its own control
setValue($name, 'Jane');              // notifies $name + $user, not $user.profile.age

const $local = useControl(0);         // component-scoped (inside a component)
```

### `createPrimitiveControl` / `usePrimitiveControl`

A lightweight control whose value is **opaque** — no nested-path access, changes detected by reference (`!==`). Cheaper than `createControl`; replace objects instead of mutating them.

```ts
createPrimitiveControl(value?, externalStorage?)
usePrimitiveControl(value?, externalStorage?)
```

| Parameter | Type | Description |
|---|---|---|
| `value?` | `T` or `() => T` | Initial value, or a lazy initializer. |
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
| `value?` | `T` or `(...keys) => T` | Initial value (keys come from a registry). |
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
| `stillLoading()` | `boolean` | Whether still loading. |

```ts
// loadable — fetches on first use
const $products = createAsyncControl(
  requestLoader(() => fetch('/api/products').then((r) => r.json()))
);

// manual — value pushed from outside
const $position = createAsyncControl<GeolocationPosition>();
navigator.geolocation.watchPosition((pos) => setValue($position, pos));

// component-scoped — factory builds the loader once
const $me = useAsyncControl(() =>
  requestLoader(() => fetch('/api/me').then((r) => r.json()))
);
```

### `createDerivedControl` / `useDerivedControl`

A control computed from one or more source controls, recomputing on any source change. With no mapper it mirrors a single source.

Settable via `setValue` as a local override — but a source recompute overrides it; if a source change and a `setValue` on the derived control land in the **same flush**, the source wins.

```ts
createDerivedControl(...controls, mapper?)
useDerivedControl(...controls, mapper?)
```

| Parameter | Type | Description |
|---|---|---|
| `...controls` | `ReadonlyControl[]` | One or more source controls. |
| `mapper?` | `(...values) => result` | Combines the sources' current values. Runs on every change; async sources provide `value` or `undefined`. |

```ts
const $copy = createDerivedControl($source);                                  // mirror one source
const $count = createDerivedControl($items, (items) => items?.length ?? 0);   // map one source
const $fullName = createDerivedControl($first, $last, (f, l) => `${f} ${l}`); // combine many
```

### `createAsyncDerivedControl` / `useAsyncDerivedControl`

An async control computed from sources. The mapper runs only while **every** source is ready (has a value) and error-free; otherwise the control is loading, or holds an [`AggregateControlError`](#isaggregatecontrolerrorerr) with the source errors (last slot = the mapper's own throw). Using it loads loadable sources; `invalidate` reloads them.

Settable via `setValue` as a local override — but a source recompute overrides it; if a source change and a `setValue` on the derived control land in the **same flush**, the source wins.

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

A promise that **resolves** with an async control's value once ready, or **rejects** with its error. Doesn't start loading (the control must be in use or loaded via [`load`](#loadcontrol)).

| Parameter | Type | Description |
|---|---|---|
| `control` | `ReadonlyAsyncControl` | The async control. |

```ts
const user = await toPromise($user);
```

### `useSuspenseValue(control, safe?)`

The value of an async control, **suspending** while it loads. Requires the [`Suspense`](#suspense) boundary above.

| Parameter | Type | Description |
|---|---|---|
| `control` | `ReadonlyAsyncControl` (or falsy) | The async control; falsy → returns `undefined`. |
| `safe?` | `boolean` | If `true`, returns `[value, error]` instead of throwing the error to the boundary. |

```ts
const user = useSuspenseValue($user);
const [user, error] = useSuspenseValue($user, true);
```

### `useSuspenseValues(controls, safe?)`

Like `useSuspenseValue` for an array — suspends until **all** are ready. Array length must stay constant across renders.

| Parameter | Type | Description |
|---|---|---|
| `controls` | `ReadonlyAsyncControl[]` | The async controls. |
| `safe?` | `boolean` | If `true`, returns `[values, errors]`. |

```ts
const [user, cart] = useSuspenseValues([$user, $cart]);
```

### `useInfiniteValues(controls)`

Current values of a **dynamic-length** list of same-typed controls (the array may grow/shrink between renders) — for paginated/infinite data. Async controls provide `value` or `undefined` and start loading when consumed.

| Parameter | Type | Description |
|---|---|---|
| `controls` | `ReadonlyControl[]` | Same-typed controls; length may change between renders. |

```ts
const pages = useInfiniteValues(pageNumbers.map((p) => productsRegistry.get(p)));
```

---

## Writing values

### `setValue(control, value, scheduler?)`

Sets a control's value. Batched — committed on the next flush, notifying only changed paths.

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

Resets an async control — clears value, error and ready status — and reloads if it's in use.

| Parameter | Type | Description |
|---|---|---|
| `control` | `AsyncControl` | The async control. |
| `silentOrScheduler?` | `boolean` or `Scheduler` | `true` keeps the current value while reloading (stale-while-revalidate); or a `Scheduler` to batch the flush. |

```ts
invalidate($user);
invalidate($user, true);   // keep value while reloading
```

---

## Subscribing

### `watchValue(control, callback, immediate?)`

Runs `callback` on every value change. Returns an **unwatch** function.

| Parameter | Type | Description |
|---|---|---|
| `control` | `ReadonlyControl` | The control. |
| `callback` | `(value, prevValue) => void` | May return a cleanup, run before the next call and on unwatch. |
| `immediate?` | `boolean` | If `true`, also runs now with the current value (previous = `undefined`). |

```ts
const unwatch = watchValue($theme, (theme, prevTheme) => {
  console.log(`theme: ${prevTheme} -> ${theme}`);
});
```

### `watchValues(controls, callback, immediate?)`

Like `watchValue` for multiple controls — one call per flush.

| Parameter | Type | Description |
|---|---|---|
| `controls` | `ReadonlyControl[]` | The controls. |
| `callback` | `(values, prevValues) => void` | Positional value arrays; may return a cleanup. |
| `immediate?` | `boolean` | Also run now with current values (previous = all `undefined`). |

```ts
const unwatch = watchValues([$query, $page], ([query, page]) => {
  console.log(`search: "${query}", page ${page}`);
});
```

### `load(control)`

Marks the control **in use** → starts its loading (and that of its loadable sources) **without subscribing** — e.g. prefetching. Returns a release function; loading stops when no other usage remains. Safe to call more than once.

| Parameter | Type | Description |
|---|---|---|
| `control` | `ReadonlyControl` | The control to prefetch. |

```ts
const release = load($products);
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
Returns a `boolean` control — `true` while a load is in flight, `false` otherwise.

| Parameter | Type | Description |
|---|---|---|
| `control` | `ReadonlyAsyncControl` | The async control. |

### `selectReady(control)`
Returns a `true`/`undefined` control — `true` once the control has a value (ready), `undefined` before it ever resolves or while pending with no value (first load, after `invalidate`). Distinct from loading: it stays `true` through a background reload that keeps the value. Await/suspend on readiness without re-rendering on every value change.

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
  render={(user, cart) => <p>{user.name} — {cart.length} items</p>}
/>
```

### `<InfiniteControlsConsumer>`

Render-prop over a **dynamic-length** list of same-typed controls (component form of [`useInfiniteValues`](#useinfinitevaluescontrols)).

| Prop | Type | Description |
|---|---|---|
| `controls` | `ReadonlyControl[]` | Same-typed; length may change between renders. |
| `render` | `(values) => ReactNode` | Renders the values array. |

### `<Suspense>`

Drop-in replacement for `React.Suspense`, **required** around components that use the suspense **hooks** ([`useSuspenseValue`](#usesuspensevaluecontrol-safe) / [`useSuspenseValues`](#usesuspensevaluescontrols-safe)) — it tracks the loadings suspended components start and releases them when they resolve or unmount. The `Suspense*Consumer` components include their own boundary, so they don't need it.

| Prop | Type | Description |
|---|---|---|
| `fallback` | `ReactNode` | Shown while suspended. |
| `children` | `ReactNode` | The subtree. |

```jsx
const User = () => {
  const user = useSuspenseValue($user);
  return <h2>{user.name}</h2>;
};

<Suspense fallback={<p>Loading…</p>}>
  <User />
</Suspense>
```

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

Multi-control `SuspenseControlConsumer` — suspends until all are ready.

| Prop | Type | Description |
|---|---|---|
| `controls` | `ReadonlyAsyncControl[]` | The async controls. |
| `render` | `(...values) => ReactNode` | Positional values. |
| `fallback` | `ReactNode` | Shown while loading. |
| `renderIfError?` | render fn, `ReactNode`, or `true` | Render on any error. |
| `container?` | `ContainerComponent` | Wraps content/fallback when non-empty. |

### `wrapErrorBoundary(BoundaryComponent)`

Wraps a class error boundary so that, when it catches an error, the loadings started by components suspended beneath it are **released** (otherwise they leak — a thrown component never commits, so React can't clean them up).

| Parameter | Type | Description |
|---|---|---|
| `BoundaryComponent` | `ComponentClass` | The error-boundary class to wrap. |

```tsx
export default wrapErrorBoundary(ErrorBoundary);
```

---

## Utils

### `$pending`

An async control stuck **loading forever** (value `undefined`, never settles, writes are no-ops). A placeholder where a control is expected but not yet available.

```jsx
{/* $user may be undefined until selected — $pending keeps the fallback shown */}
<SuspenseControlConsumer
  control={$user || $pending}
  fallback={<p>Loading…</p>}
  render={(user) => <h2>{user.name}</h2>}
/>
```

### `isAggregateControlError(err)`

Type guard for `AggregateControlError` — the error of a derived/bound control. Its `.errors` is **positional**: one slot per source in order, the last slot the control's own (mapper) error; error-free slots are `undefined`.

| Parameter | Type | Description |
|---|---|---|
| `err` | `unknown` | Value to test. |

```ts
if (isAggregateControlError(err)) {
  err.errors.forEach((e, i) => e && console.error(i, e));
}
```

---

## Registry

### `createRegistry(create, initArg?, options?)`

A **keyed collection** of controls — one control per distinct key tuple, created and cached lazily on first access.

| Parameter | Type | Description |
|---|---|---|
| `create` | `createControl`, `createPrimitiveControl`, or `createAsyncControl` | The control constructor. |
| `initArg?` | constructor's arg | For async, an `AsyncControlOptions` (its `value` and a loader's `fetch` receive the item's keys); otherwise a default value or `(...keys) => value`. |
| `options?` | `RegistryOptions` | See below. |

**`RegistryOptions`**

| Field | Type | Description |
|---|---|---|
| `externalStorage?` | `SyncExternalStorage` | External storage backing each item's value (receives the item's keys) — any storage with sync reads; persisting via [`getPersistStorage`](#getpersiststorageoptions) is one use of it. |
| `keepPrev?` | `boolean` or `boolean[]` | For bound controls: keep showing the previous value while a re-targeted item loads, instead of blanking to `undefined`. An array decides per key — e.g. `[false, true]` keeps the value on the second key's changes but blanks on the first's; when several keys change at once, every changed key must allow keeping. The held value is replaced once the item produces one. |
| `suppressError?` | `boolean` | For bound controls: swallow an error while there is a previous value to show — it surfaces only when there's nothing to hold. On re-targets it applies only where `keepPrev` holds. |

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
| `value?` | `T` or `(...keys) => T` | Initial value. |
| `syncedKeysCount?` | `number` | Trailing keys whose controls poll in sync (share one clock); omit for independent polling. |
| `isolatedLanes?` | `boolean` | Each synced group commits on its own lane. |
| `reloadIfStale?` / `reloadOnFocus?` / `loadingTimeout?` / … | | Async options, as in `AsyncControlOptions`. |

**`actions`**

| Method | Description |
|---|---|
| `pause(...keys)` | Pause polling under the keys (leading group keys when `syncedKeysCount` is set, full keys otherwise). |
| `resume(...keys)` | Resume polling under the keys. |
| `reset(...keys)` | Refetch now and restart the interval. |

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
| `storage` | `PersistStorage` or `undefined` | The storage to read/write — [`safeLocalStorage`](#safelocalstorage), [`safeSessionStorage`](#safesessionstorage), or a custom `PersistStorage`. |
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

Ready-made controls bound to browser state — import and read, no setup. Safe to import on the server (default values, no listeners attached).

### `mediaQuery(query)`

Returns a boolean control tracking whether the media `query` matches, kept in sync with [`matchMedia`](https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia). Created once per query and reused after — safe to call inline.

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
An **async control** of connectivity: `true` while online, `undefined` while offline. Since offline means "not ready", the async tooling just works — [`toPromise`](#topromisecontrol)`($online)` waits for reconnection, [`useSuspenseValue`](#usesuspensevaluecontrol-safe)`($online)` suspends a component while offline.

```ts
await toPromise($online);   // wait until back online, then retry
```

### `$pageVisible`
A `boolean` control — `true` while the tab is visible, `false` while hidden.

### `$windowSize`
A `{ width, height }` control of the window's inner size, kept in sync with `resize` and `orientationchange` (committed once per animation frame). `width` and `height` are nested controls — subscribe to one without re-rendering on the other.

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

A `Scheduler` is just `(cb: () => void) => any` — it receives a flush callback and decides when to run it. So **any** such function works, not only the factories below: pass `requestAnimationFrame`, `queueMicrotask`, `requestIdleCallback`, React's `startTransition`, or `(cb) => setTimeout(cb, ms)` directly. The factories add state (a `.flush()` handle, coalescing) on top.

```ts
import { startTransition } from 'react';

setValue($filter, value, requestAnimationFrame);          // commit before next paint
setValue($filter, value, startTransition);                // commit as a React transition
setValue($filter, value, (cb) => setTimeout(cb, 200));    // commit after 200ms
```

### `batch(callback, scheduler?)`

Runs `callback` as part of the scheduler's flush. Anything inside it — control writes **and** external side-effects like React `setState` — lands in the same flush, so they coalesce into a **single re-render**. If already inside a flush, runs immediately and joins it.

Coalescing only happens between `batch` and writes on the **same scheduler** (same flush). They share a flush by default (both microtask); pass the same custom `scheduler` to both to coalesce on it.

| Parameter | Type | Description |
|---|---|---|
| `callback` | `() => void` | Run within the flush — its control writes and any `setState` share that flush. |
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

**Returns** — a `Scheduler` with `flush(): boolean` (runs the pending commit; `true` if there was one).

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

**Returns** — a `Scheduler` with `flush(): boolean` (force the pending commit now).

```ts
const throttle = createThrottleScheduler(100);

window.addEventListener('pointermove', (e) => {
  setValue($cursor, { x: e.clientX, y: e.clientY }, throttle);   // ≤1 commit per 100ms
});
```

### `createDebounceScheduler(ms)`

Delays the flush until `ms` of quiet — each update resets the timer, so it commits once updates stop.

| Parameter | Type | Description |
|---|---|---|
| `ms` | `number` | Quiet period in milliseconds. |

**Returns** — a `Scheduler` with `flush(): boolean`.

```ts
const debounce = createDebounceScheduler(300);
setValue($search, value, debounce);   // commits 300ms after the last change
```
