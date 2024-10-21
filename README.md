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

- [createState / createNestedState](#createstate)
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
| [.isLoaded](#.isLoaded)                                                                                                               |       ❌        |            ✅             |               ✅                |                           ✅                            |
| [.load](#.load)                                                                                                                       |       ❌        |            ❌             |               ✅                |                           ✅                            |
| [withoutLoading](#withoutloading)                                                                                                     |       ❌        |            ❌             |               ✅                |                           ✅                            |
| [.pause](#.pause)                                                                                                                     |       ❌        |            ❌             |               ❌                |                           ✅                            |
| [.resume](#.resume)                                                                                                                   |       ❌        |            ❌             |               ❌                |                           ✅                            |
| [.reset](#.reset)                                                                                                                     |       ❌        |            ❌             |               ❌                |                           ✅                            |

- [createStateStorage](#createstatestorage)

- [createPaginatedStorage](#createstatestorage) / [Pagination](#pagination)

- [Suspense](#suspense)
- [wrapErrorBoundary](#wraperrorboundary)

- [SkeletonMode](#skeletonmode)
- [SKELETON_STATE](#skeleton_state)

### method

---

## License

MIT © [Krombik](https://github.com/Krombik)
