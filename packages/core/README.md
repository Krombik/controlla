# react-state-forge

A lightweight and modular state management library for React applications, designed to handle various state scenarios such as **basic**, **asynchronous**, **loadable**, and **controllable** states. With support for **nested states** and seamless integration with **React Suspense**, this library ensures efficient state management by minimizing unnecessary rerenders.

This library covers a broad range of state needs, from **simple value storage** to **asynchronous data management** and **polling-based controls**:

- **Loadable State**: Suitable for **on-demand data fetching** (e.g., API requests).
- **Controllable Loadable State**: Ideal for managing **polling, WebSocket connections, or Server-Sent Events (SSE)**, giving you the ability to **pause, resume, or reset** the loading process.

Whether you need simple state handling, asynchronous logic, or precise control over complex loading flows, this library provides the flexibility to fit your needs.

## Installation

using npm:

```
npm install --save react-state-forge
```

or yarn:

```
yarn add react-state-forge
```

or pnpm:

```
pnpm add react-state-forge
```

---

## API

- [createState](#createstate) / [createNestedState](#createnestedstate)
- [createAsyncState / createAsyncNestedState](#createasyncstate)
- [createRequestableState / createRequestableNestedState](#createrequestablestate)
- [createPollableState / createPollableNestedState](#createpollablestate)

|                                                                                                                                       | [State](#state) | [AsyncState](#asyncstate) | [LoadableState](#loadablestate) | [ControllableLoadableState](#controllableloadableState) |
| ------------------------------------------------------------------------------------------------------------------------------------- | :-------------: | :-----------------------: | :-----------------------------: | :-----------------------------------------------------: |
| [getValue](#getvalue)                                                                                                                 |       ✅        |            ✅             |               ✅                |                           ✅                            |
| [setValue](#setvalue)                                                                                                                 |       ✅        |            ✅             |               ✅                |                           ✅                            |
| [onValueChange](#onvaluechange)                                                                                                       |       ✅        |            ✅             |               ✅                |                           ✅                            |
| [useValue](#usevalue) / [Controller](#controller)                                                                                     |       ✅        |            ✅             |               ✅                |                           ✅                            |
| [useMappedValue](#usemappedvalue) / [MappedController](#mappedcontroller)                                                             |       ✅        |            ✅             |               ✅                |                           ✅                            |
| [useMergedValue](usemergedvalue) / [MergedController](#mergedcontroller)                                                              |       ✅        |            ✅             |               ✅                |                           ✅                            |
| [use](#use) / [SuspenseController](#suspensecontroller)                                                                               |       ❌        |            ✅             |               ✅                |                           ✅                            |
| [useAll](#useall) / [SuspenseAllController](#suspenseallcontroller)                                                                   |       ❌        |            ✅             |               ✅                |                           ✅                            |
| [getPromise](#getpromise)                                                                                                             |       ❌        |            ✅             |               ✅                |                           ✅                            |
| [onSlowLoading](#onslowloading)                                                                                                       |       ❌        |            ✅             |               ✅                |                           ✅                            |
| [awaitOnly](#awaitonly) / [SuspenseOnlyController](#suspenseonlycontroller) / [SuspenseOnlyAllController](#suspenseonlyallcontroller) |       ❌        |            ✅             |               ✅                |                           ✅                            |
| [.error](#.error)                                                                                                                     |       ❌        |            ✅             |               ✅                |                           ✅                            |
| [.isLoaded](#.isloaded)                                                                                                               |       ❌        |            ✅             |               ✅                |                           ✅                            |
| [.load](#.load)                                                                                                                       |       ❌        |            ❌             |               ✅                |                           ✅                            |
| [withoutLoading](#withoutloading)                                                                                                     |       ❌        |            ❌             |               ✅                |                           ✅                            |
| [.loading.pause](#.loading.pause)                                                                                                     |       ❌        |            ❌             |               ❌                |                           ✅                            |
| [.loading.resume](#.loading.resume)                                                                                                   |       ❌        |            ❌             |               ❌                |                           ✅                            |
| [.loading.reset](#.loading.reset)                                                                                                     |       ❌        |            ❌             |               ❌                |                           ✅                            |

- [createStateStorage](#createstatestorage)

- [createPaginatedStorage](#createstatestorage) / [Pagination](#pagination)

- [Suspense](#suspense)
- [wrapErrorBoundary](#wraperrorboundary)

- [bachedUpdates](#butchedupdates)

- [SKELETON_STATE](#skeleton_state)

### createState

```ts
createState<T>(): State<T | undefined>;

createState<T>(initialValue: T): State<T>;

createState<T>(getInitialValue: () => T): State<T>;
```

Creates a basic state with an initial value.

```tsx
import createState from 'react-state-forge/createState';
import useValue from 'react-state-forge/useValue';
import setValue from 'react-state-forge/setValue';

const togglerState = createState(false);

const Togglers = () => (
  <div>
    <button
      onClick={() => {
        setValue(togglerState, true);
      }}
    >
      turn on
    </button>
    <button
      onClick={() => {
        setValue(togglerState, false);
      }}
    >
      turn off
    </button>
    <button
      onClick={() => {
        setValue(togglerState, (prevValue) => !prevValue);
      }}
    >
      switch
    </button>
  </div>
);

const Light = () => {
  const value = useValue(togglerState);

  return <div>light {value ? 'on' : 'off'}</div>;
};

const Component = () => (
  <div>
    <div>
      <Light />
    </div>
    <div>
      <Togglers />
    </div>
  </div>
);
```

---

### createNestedState

```ts
createNestedState<T>(): NestedState<T | undefined>;

createNestedState<T>(initialValue: T): NestedState<T>;

createNestedState<T>(getInitialValue: () => T): NestedState<T>;
```

Creates a **nested state**, where individual parts behave independently, triggering updates only when specific parts change. It allows for more efficient reactivity in complex data structures by minimizing unnecessary rerenders.

```tsx
import createNestedState from 'react-state-forge/createNestedState';
import useValue from 'react-state-forge/useValue';
import setValue from 'react-state-forge/setValue';

const userState = createNestedState({
  profile: { name: 'Alice', age: 25 },
});

const Name = () => {
  const nameState = userState.scope().profile.name.end$;

  const name = useValue(nameState);

  return (
    <input
      value={name}
      onChange={(e) => {
        setValue(nameState, e.target.value);
      }}
    />
  );
};

const Age = () => {
  const ageState = userState.scope().profile.age.end$;

  const age = useValue(ageState);

  return (
    <input
      value={age}
      type='number'
      onChange={(e) => {
        setValue(ageState, +e.target.value);
      }}
    />
  );
};

const Component = () => (
  <div>
    <div>
      <Name />
    </div>
    <div>
      <Age />
    </div>
  </div>
);
```

---

### createAsyncState

Creates a state with varying levels of capabilities based on the provided options:

<ul>
<li>
<h3 id="asyncstate">AsyncState</h3>

```ts
createAsyncState<T, E = any>(
  options?: AsyncStateOptions<T>
): AsyncState<T, E>;

type AsyncStateOptions<T> = {
  value?: T | (() => T);
  isLoaded?(value: T, prevValue: T | undefined, attempt: number): boolean;
};
```

represents a state that supports asynchronous operations. It extends a regular state by introducing the following additional internal states:

- <b id=".error">.error</b>: A state that holds the latest error, if one occurred during loading.
- <b id=".isloaded">.isLoaded</b>: A state that indicates whether the state has successfully loaded.

</li>
<li>
<h3 id="laodablestate">LoadableState</h3>

```ts
createAsyncState<T, E = any>(
  options: LoadableStateOptions<T, E>
): LoadableState<T, E>;

type LoadableStateOptions<T, E = any> = AsyncStateOptions<T> & {
  load(this: AsyncState<T, E>): void | (() => void);
  loadingTimeout?: number;
  reloadIfStale?: number;
  reloadOnFocus?: number;
};
```

Extends [AsyncState](#asyncstate) with additional loading functionality, allowing the state to be loaded or reloaded.

</li>
<li>
<h3 id="controllableloadablestate">ControllableLoadableState</h3>

Extends [LoadableState](#laodablestate) with additional control over the loading process, including pause, resume, and reset.

```ts
createAsyncState<T, E = any>(
  options: ControllableLoadableStateOptions<T, E>
): ControllableLoadableState<T, E>;

type ControllableLoadableStateOptions<T, E = any> = LoadableStateOptions<
  T,
  E
> & {
  pause(): void;
  resume(): void;
  reset(): void;
};
```

</li>
</ul>

---

## License

MIT © [Krombik](https://github.com/Krombik)
