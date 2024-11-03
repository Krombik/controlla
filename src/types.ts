import type { Primitive, PrimitiveOrNested } from 'keyweaver';
import type { $tate } from './utils/constants';
import type { ComponentType, PropsWithChildren } from 'react';

declare const PENDING: unique symbol;

export type ResolvedValue<Value> = Exclude<Value, typeof PENDING>;

export type HandlePending<Value> = [Extract<Value, typeof PENDING>] extends [
  never,
]
  ? Value
  : ResolvedValue<Value> | undefined;

type Nil = null | undefined;

export type Falsy = Nil | false | 0 | '';

export type ValueChangeCallbacks = Set<(value: any) => void>;

export type StateCallbackMap = {
  _root: ValueChangeCallbacks | null;
  _children: Map<string, StateCallbackMap> | null;
  readonly _parent?: StateCallbackMap;
};

export type StateInternalUtils = {
  _value: any;
  _set(nextValue: any, path: readonly string[], isError?: boolean): void;
  _get(path: readonly string[]): any;
  _onValueChange(cb: (value: any) => void, path: readonly string[]): () => void;
};

declare const STATE_IDENTIFIER: unique symbol;

type StorageKeys<Keys extends PrimitiveOrNested[]> = Keys['length'] extends 0
  ? {}
  : {
      /** Represents the keys that define the hierarchical structure of the storage. */
      readonly keys: Readonly<Keys>;
    };

export type Internal<T> = {
  /** @internal */
  readonly _internal: T;
};

declare class StateBase {}

/**
 * Represents a basic reactive state that holds a value.
 *
 * @example
 * ```ts
 * const state: State<number> = createState(0);
 * ```
 */
export type State<
  Value = any,
  Keys extends PrimitiveOrNested[] = [],
> = StateBase & {
  readonly [STATE_IDENTIFIER]: Value;
  /** @internal */
  readonly _anchor?: Readonly<{}>;
} & StorageKeys<Keys> &
  /** @internal */
  Internal<StateInternalUtils> &
  /** @internal */
  Partial<StorageKeys<any[]>> &
  /** @internal */
  InternalPathBase;

export type ErrorStateUtils = {
  _parentUtils: StateInternalUtils & AsyncStateUtils;
  readonly _isExpectedError?: (error: any) => boolean;
  _commonSet: StateInternalUtils['_set'];
};

export type AsyncStateUtils = {
  _isLoaded(value: any, prevValue: any, attempt: number | undefined): boolean;
  _commonSet: StateInternalUtils['_set'];
  readonly _slowLoading: {
    _handle(isLoadedUtils: StateInternalUtils): void;
    readonly _timeout: number;
    _timeoutId: ReturnType<typeof setTimeout> | undefined;
    readonly _callbackSet: Set<() => void>;
  } | null;
  _load: (() => (() => void) | void) | undefined;
  _counter: number;
  _isLoadable: boolean;
  _isFetchInProgress: boolean;
  readonly _errorUtils: ErrorStateUtils & StateInternalUtils;
  readonly _isLoadedUtils: StateInternalUtils;
  _promise: {
    readonly _promise: Promise<any>;
    _resolve(value: any): void;
    _reject(error: any): void;
  } | null;
  _unload: (() => void) | void | undefined;
  _attempt: number | undefined;
  readonly _reloadIfStale: {
    readonly _timeout: number;
    _timeoutId: ReturnType<typeof setTimeout> | undefined;
  } | null;
  readonly _reloadOnFocus: {
    readonly _timeout: number;
    _timeoutId: ReturnType<typeof setTimeout> | undefined;
    _isLoadable: boolean;
    _focusListener: (() => void) | undefined;
  } | null;
};

/**
 * Represents a state that manages an asynchronous value, including {@link AsyncState.isLoaded loading} and {@link AsyncState.error error} states.
 * Extends {@link State}.
 */
export type AsyncState<
  Value = any,
  Error = any,
  Keys extends PrimitiveOrNested[] = [],
> = State<Value | typeof PENDING, Keys> &
  /** @internal */
  Internal<AsyncStateUtils> & {
    /** @internal */
    readonly _awaitOnly?: true;
    /** A state that holds the latest error, if one occurred during loading. */
    readonly error: State<Error | undefined> &
      /** @internal */
      Internal<ErrorStateUtils>;
    /** A state that indicates whether the state has successfully loaded */
    readonly isLoaded: State<boolean>;
  };

/**
 * Represents a state that supports loading functionality, extending {@link AsyncState}
 * with a method to initiate and manage the loading process.
 */
export type LoadableState<
  Value = any,
  Error = any,
  Keys extends PrimitiveOrNested[] = [],
> = AsyncState<Value, Error, Keys> & {
  /** @internal */
  readonly _withoutLoading?: true;
  /**
   * Initiates the loading process for the state if it has not already started.
   * If the loading process is already active, it increases the load listener count.
   *
   * The returned function decreases the load listener count, and the loading process
   * will only be canceled if there are no remaining load listeners.
   *
   * @param {boolean} [force=false] - If `true`, forces the loading process to reload,
   * even if it has previously completed or is in progress.
   * @returns - A function to decrease the load listener count. The loading
   * process is only marked as cancelable when all listeners have been removed.
   *
   * @example
   * ```ts
   * const decreaseLoadListener = state.load();
   *
   * // Call decreaseLoadListener to decrease the load listener count.
   * // The loading process is only canceled if no other listeners remain.
   * decreaseLoadListener();
   * ```
   */
  load(force?: boolean): () => void;
};

/**
 * Represents a loadable state whose loading process can be controlled. Extends {@link LoadableState}.
 */
export type ControllableLoadableState<
  Value = any,
  Error = any,
  Keys extends PrimitiveOrNested[] = [],
> = LoadableState<Value, Error, Keys> & {
  /** Provides control methods for managing the loading process of the state. */
  readonly loading: {
    /** Pauses the current loading process. */
    pause(): void;
    /** Resumes a paused loading process. */
    resume(): void;
    /** Resets the loading process, starting it from the beginning. */
    reset(): void;
  };
};

export type InternalPathBase = {
  /** @internal */
  readonly _path?: readonly string[];
};

export type StateScope<Scope extends () => any> = {
  /**
   * @returns scoped version of the state, allowing access to nested state values.
   *
   * @example
   * ```js
   * const state = nestedState.scope().some.nested.path.$tate;
   * ```
   */
  scope: Scope;
};

type EndOfScope<T, IsRoot extends boolean = false> = IsRoot extends false
  ? {
      readonly [$tate]: T;
    }
  : {};

type StringToNumber<T> = T extends `${infer K extends number}` ? K : never;

type ToIndex<T> = [Exclude<T, keyof []>] extends [never]
  ? number
  : StringToNumber<T>;

type ProcessStateScopeItem<
  T,
  key,
  Keys extends PrimitiveOrNested[],
  S extends State,
  NS extends NestedState,
  IsUndefined extends boolean,
> = ProcessStateScope<
  Exclude<T, Nil>[key extends keyof Exclude<T, Nil> ? key : never],
  Keys,
  S,
  NS,
  IsUndefined extends true
    ? true
    : [Extract<T, Nil>] extends [never]
      ? false
      : true,
  false
>;

type IsAny<T> = 0 extends 1 & T ? true : false;

type AnyScope<S, IsRoot extends boolean = true> = {
  readonly [key in string | number]: AnyScope<S, false>;
} & EndOfScope<S, IsRoot>;

type ProcessStateScope<
  T,
  Keys extends PrimitiveOrNested[],
  S extends State,
  NS extends NestedState,
  IsUndefined extends boolean = false,
  IsRoot extends boolean = true,
> =
  IsAny<T> extends true
    ? AnyScope<S>
    : Exclude<T, Nil> extends Primitive
      ? EndOfScope<
          ProcessState<
            S,
            T | (IsUndefined extends true ? undefined : never),
            Keys
          >
        >
      : (Exclude<T, Nil> extends any[]
          ? {
              readonly [key in ToIndex<
                keyof Exclude<T, Nil>
              >]-?: ProcessStateScopeItem<T, key, Keys, S, NS, IsUndefined>;
            }
          : {
              readonly [key in keyof Exclude<T, Nil>]-?: ProcessStateScopeItem<
                T,
                key,
                Keys,
                S,
                NS,
                IsUndefined
              >;
            }) &
          EndOfScope<
            ProcessState<
              NS,
              T | (IsUndefined extends true ? undefined : never),
              Keys
            >,
            IsRoot
          >;

/**
 * Represents a state that supports nested structures, allowing access to
 * and management of deeper state values. Extends {@link State} and provides
 * a {@link NestedState.scope scope} method for working with nested parts of the state.
 */
export type NestedState<
  Value = any,
  Keys extends PrimitiveOrNested[] = [],
> = State<Value, Keys> &
  StateScope<() => ProcessStateScope<Value, Keys, State, NestedState>>;

/**
 * Represents an asynchronous state that supports nested structures, allowing
 * for the management of asynchronous values within a hierarchical state setup.
 * Extends {@link AsyncState} and provides a {@link AsyncNestedState.scope scope} method for accessing nested
 * parts of the state.
 */
export type AsyncNestedState<
  Value = any,
  Error = any,
  Keys extends PrimitiveOrNested[] = [],
> = AsyncState<Value, Error, Keys> &
  StateScope<
    () => ProcessStateScope<Value, Keys, AsyncState, AsyncNestedState>
  >;

/**
 * Represents a loadable state that supports nested structures, allowing
 * for organized and hierarchical management of loadable values. Extends
 * {@link LoadableState} and provides a {@link LoadableNestedState.scope scope} method for accessing and managing
 * nested parts of the state.
 */
export type LoadableNestedState<
  Value = any,
  Error = any,
  Keys extends PrimitiveOrNested[] = [],
> = LoadableState<Value, Error, Keys> &
  StateScope<
    () => ProcessStateScope<Value, Keys, LoadableState, LoadableNestedState>
  >;

/**
 * Represents a loadable state that supports nested structures and allows
 * control over the loading process. Extends {@link ControllableLoadableState}
 * and provides a {@link ControllableLoadableNestedState.scope scope} method for managing and accessing nested parts of the state.
 */
export type ControllableLoadableNestedState<
  Value = any,
  Error = any,
  Keys extends PrimitiveOrNested[] = [],
> = ControllableLoadableState<Value, Error, Keys> &
  StateScope<
    () => ProcessStateScope<
      Value,
      Keys,
      ControllableLoadableState,
      ControllableLoadableNestedState
    >
  >;

export type AnyAsyncState<
  Value = any,
  Error = any,
  Keys extends PrimitiveOrNested[] = [],
> =
  | AsyncState<Value, Error, Keys>
  | LoadableState<Value, Error, Keys>
  | ControllableLoadableState<Value, Error, Keys>;

export type AnyLoadableState<
  Value = any,
  Error = any,
  Keys extends PrimitiveOrNested[] = [],
> =
  | LoadableState<Value, Error, Keys>
  | ControllableLoadableState<Value, Error, Keys>;

export type ExtractValues<
  T extends Array<AsyncState | Falsy>,
  Nullable extends boolean = false,
> = Readonly<{
  [index in keyof T]: T[index] extends AsyncState<infer K>
    ? K | (Nullable extends false ? never : undefined)
    : undefined;
}>;

export type ExtractErrors<T extends Array<AsyncState | Falsy>> = Readonly<{
  [index in keyof T]: T[index] extends AsyncState<any, infer K>
    ? K | undefined
    : undefined;
}>;

export type ArrayOfUndefined<T extends any[]> = Readonly<{
  [index in keyof T]: undefined;
}>;

export type AsyncStateOptions<
  T,
  E = any,
  Keys extends PrimitiveOrNested[] = [],
> = {
  /** The initial value of the state or a function to resolve it using keys. */
  value?: ResolvedValue<T> | ((...keys: Keys) => ResolvedValue<T>);
  /** A function to determine if the state is considered loaded, based on the {@link value current} and {@link prevValue previous} values and the number of loading {@link attempt attempts}. */
  isLoaded?(
    value: ResolvedValue<T>,
    prevValue: ResolvedValue<T> | undefined,
    attempt: number
  ): boolean;
  /** The timeout in milliseconds for considering the loading process slow. */
  loadingTimeout?: number;
  /**
   * A type guard function used to determine if an error is considered an expected error.
   *
   * If `isExpectedError` returns `false` for an error, subsequent attempts to retrieve
   * the value of the associated error state using `getValue` or any hook will throw the error.
   * This ensures that unexpected errors are surfaced when accessing the error state.
   */
  isExpectedError?(error: any): error is E;
};

export type LoadableStateOptions<
  T,
  E = any,
  Keys extends PrimitiveOrNested[] = [],
> = AsyncStateOptions<T, E, Keys> & {
  /**
   * A function to initiate the loading process. This method can optionally return
   * a cleanup function to be called when the loading is complete or canceled.
   */
  load(this: AsyncState<T, E>, ...keys: Keys): void | (() => void);
  /**
   * The duration in milliseconds. If set, the state will reload
   * if accessed again after this time has passed since the last load.
   */
  reloadIfStale?: number;
  /**
   * The duration in milliseconds. If set, the state will reload
   * when the tab gains focus after this duration has passed since the last load.
   */
  reloadOnFocus?: number;
};

export type ControllableLoadableStateOptions<
  T,
  E = any,
  Keys extends PrimitiveOrNested[] = [],
> = LoadableStateOptions<T, E, Keys> & {
  /** Pauses the current loading process, preventing further progress until resumed. */
  pause(): void;
  /** Resumes a paused loading process, allowing it to continue. */
  resume(): void;
  /** Resets the loading process, starting it over from the beginning. */
  reset(): void;
};

export type RequestableStateOptions<
  T,
  E = any,
  Keys extends PrimitiveOrNested[] = [],
> = Pick<
  LoadableStateOptions<T, E, Keys>,
  | 'value'
  | 'loadingTimeout'
  | 'reloadIfStale'
  | 'reloadOnFocus'
  | 'isExpectedError'
> & {
  /** @internal */
  _beforeLoad?(args: PrimitiveOrNested[], utils: AsyncState['_internal']): void;
  /** @internal */
  _afterLoad?(
    args: PrimitiveOrNested[] | void,
    utils: AsyncState['_internal']
  ): Promise<PrimitiveOrNested[] | void>;
  /**
   * A function that starts the loading process for the state and returns a promise
   * that resolves with the loaded value.
   */
  load(...args: Keys): Promise<ResolvedValue<T>>;
  /**
   * A function that determines whether the loading process should be retried after an error occurs.
   * @param err - The error encountered during the loading attempt.
   * @param attempt - The number of loading attempts made so far.
   * @returns The delay in milliseconds before retrying, or `0` to stop retrying.
   */
  shouldRetryOnError?(err: E, attempt: number): number;
};

export type PollableStateOptions<
  T,
  E = any,
  Keys extends PrimitiveOrNested[] = [],
> = RequestableStateOptions<T, E, Keys> &
  Pick<AsyncStateOptions<T>, 'isLoaded'> & {
    /** The interval in milliseconds at which the state should poll for new data. */
    interval: number;
    /**
     * The interval in milliseconds for polling when the document is hidden (e.g., when the tab is not in focus).
     * If set to `0`, polling is disabled while the tab is hidden.
     */
    hiddenInterval?: number;
  };

type KeysOfStorage<T, Acc extends PrimitiveOrNested[] = []> =
  T extends StateStorageMarker<infer Key extends PrimitiveOrNested, infer Item>
    ? KeysOfStorage<Item, [...Acc, Key]>
    : Acc;

export type StorageKeysWithoutPagination<
  T,
  Acc extends PrimitiveOrNested[] = [],
> =
  T extends PaginatedStateStorage<any>
    ? Acc
    : T extends StateStorageMarker<
          infer Key extends PrimitiveOrNested,
          infer Item
        >
      ? StorageKeysWithoutPagination<Item, [...Acc, Key]>
      : Acc;

type StorageItem = State | StateStorageMarker<PrimitiveOrNested, any>;

type ProcessState<S extends State, V, Keys extends PrimitiveOrNested[] = []> =
  S extends ControllableLoadableNestedState<any, infer E>
    ? ControllableLoadableNestedState<V, E, Keys>
    : S extends ControllableLoadableState<any, infer E>
      ? ControllableLoadableState<V, E, Keys>
      : S extends LoadableNestedState<any, infer E>
        ? LoadableNestedState<V, E, Keys>
        : S extends LoadableState<any, infer E>
          ? LoadableState<V, E, Keys>
          : S extends AsyncNestedState<any, infer E>
            ? AsyncNestedState<V, E, Keys>
            : S extends AsyncState<any, infer E>
              ? AsyncState<V, E, Keys>
              : S extends NestedState
                ? NestedState<V, Keys>
                : State<V, Keys>;

type ProcessStorageItem<
  T extends StorageItem,
  Keys extends PrimitiveOrNested[],
> =
  T extends State<ResolvedValue<infer V>>
    ? ProcessState<T, V, Keys>
    : T extends StateStorage<infer K, infer T>
      ? StateStorage<K, T, Keys>
      : T;

type StateWithNestedStorageKeys<
  T,
  Keys extends PrimitiveOrNested[],
> = T extends StorageItem
  ? ProcessStorageItem<T, Keys>
  : T extends Record<string, StorageItem>
    ? {
        [key in keyof T]: ProcessStorageItem<T[key], Keys>;
      }
    : never;

type RetrieveChildState<T, Keys extends PrimitiveOrNested[]> = Keys extends [
  any,
  ...infer Tail extends PrimitiveOrNested[],
]
  ? T extends StateStorageMarker<any, infer Item>
    ? RetrieveChildState<Item, Tail>
    : T
  : T;

type RetrieveState<T> =
  T extends StateStorageMarker<any, infer Child> ? RetrieveState<Child> : T;

export type RetrieveStateOrPaginatedStorage<T> =
  T extends PaginatedStateStorage<any>
    ? T
    : T extends StateStorageMarker<any, infer Child>
      ? RetrieveStateOrPaginatedStorage<Child>
      : T;

/**
 * Represents a nested structure for state storage, recursively creating
 * a hierarchy of state storages based on the provided keys.
 */
export type NestedStateStorage<
  Keys extends PrimitiveOrNested[],
  T,
> = Keys extends [
  ...infer Head extends PrimitiveOrNested[],
  infer Tail extends PrimitiveOrNested,
]
  ? NestedStateStorage<Head, StateStorage<Tail, T, Head>>
  : T;

export declare const STATE_STORAGE_IDENTIFIER: unique symbol;

type StateStorageMarker<Key extends PrimitiveOrNested, Item> = {
  [STATE_STORAGE_IDENTIFIER]: [Key, Item];
};

type StorageUtilsBase = {
  _get(key: PrimitiveOrNested, keys: readonly PrimitiveOrNested[]): any;
  _getItem(arg1: any, arg2: any, arg3: any, utils?: Record<string, any>): any;
  readonly _storage: Map<any, any>;
  readonly _arg1: any;
  readonly _arg2: any;
  readonly _arg3?: any;
};

export type StorageUtils = StorageUtilsBase & {
  _keyStorage?: Map<string, any>;
  readonly _depth: number;
};

export type PaginatedStorageUtils = StorageUtilsBase & {
  readonly _pages: Set<number>;
  _resolvePage(page: number): void;
  _promise: Promise<void>;
  _resolve(): void;
  _shouldRevalidate(state: LoadableState): boolean;
};

type UnNestedState<S> =
  S extends ControllableLoadableState<any, infer E>
    ? ControllableLoadableState<any, E>
    : S extends LoadableState<any, infer E>
      ? LoadableState<any, E>
      : S extends AsyncState<any, infer E>
        ? AsyncState<any, E>
        : S extends State
          ? State
          : never;

type IsState<S> = S extends State ? S : never;

type ProcessStateStorageScopeItem<
  T,
  S,
  K extends PrimitiveOrNested,
  ParentKeys extends PrimitiveOrNested[],
  key,
  IsUndefined extends boolean,
> = ProcessStateStorageScope<
  Exclude<T, Nil>[key extends keyof Exclude<T, Nil> ? key : never],
  S,
  K,
  ParentKeys,
  IsUndefined extends true
    ? true
    : [Extract<T, Nil>] extends [never]
      ? false
      : true,
  false
>;

type ProcessStateStorageScope<
  T,
  S,
  Key extends PrimitiveOrNested,
  ParentKeys extends PrimitiveOrNested[],
  IsUndefined extends boolean = false,
  IsRoot extends boolean = true,
> =
  IsAny<T> extends true
    ? AnyScope<S>
    : Exclude<T, Nil> extends Primitive
      ? EndOfScope<
          StateStorage<
            Key,
            NestedStateStorage<
              KeysOfStorage<S>,
              ProcessState<
                UnNestedState<RetrieveState<S>>,
                T | (IsUndefined extends true ? undefined : never)
              >
            >,
            ParentKeys
          >
        >
      : (Exclude<T, Nil> extends any[]
          ? {
              readonly [key in ToIndex<
                keyof Exclude<T, Nil>
              >]-?: ProcessStateStorageScopeItem<
                T,
                S,
                Key,
                ParentKeys,
                key,
                IsUndefined
              >;
            }
          : {
              readonly [key in keyof Exclude<
                T,
                Nil
              >]-?: ProcessStateStorageScopeItem<
                T,
                S,
                Key,
                ParentKeys,
                key,
                IsUndefined
              >;
            }) &
          EndOfScope<
            StateStorage<
              Key,
              NestedStateStorage<
                KeysOfStorage<S>,
                ProcessState<
                  IsState<RetrieveState<S>>,
                  T | (IsUndefined extends true ? undefined : never)
                >
              >,
              ParentKeys
            >,
            IsRoot
          >;

/**
 * Represents a structured state storage system that allows retrieval and deletion
 * of state entries using specified keys.
 */
export type StateStorage<
  K extends PrimitiveOrNested,
  T,
  ParentKeys extends PrimitiveOrNested[] = [],
> = StorageKeys<ParentKeys> &
  /** @internal */
  Internal<StorageUtils> &
  /** @internal */
  InternalPathBase &
  StateStorageMarker<K, T> & {
    /**
     * Retrieves a state within the storage using the provided keys.
     *
     * @example
     * ```js
     * const state = storage.get('key', { some: { nested: ['key'] } });
     * ```
     */
    get<Keys extends [K, ...Partial<KeysOfStorage<T>>]>(
      ...keys: Keys
    ): StateWithNestedStorageKeys<
      RetrieveChildState<
        T,
        Keys extends [any, ...infer Tail extends PrimitiveOrNested[]]
          ? Tail
          : []
      >,
      [...ParentKeys, ...Keys]
    >;
    /**
     * Deletes a state entry from the storage associated with the given key.
     *
     * **Warning**: This is an unsafe method. It only removes the state entry from
     * the storage but does not clear or reset the state itself.
     */
    delete(key: K): void;
  } & (T extends StateScope<() => any>
    ? StateScope<
        () => ProcessStateStorageScope<
          RetrieveState<T> extends State<infer V> ? ResolvedValue<V> : never,
          T,
          K,
          ParentKeys
        >
      >
    : {});

type ProcessPaginatedStorageScopeItem<
  T,
  S extends LoadableState,
  ParentKeys extends PrimitiveOrNested[],
  key,
  IsUndefined extends boolean,
> = ProcessPaginatedStorageScope<
  Exclude<T, Nil>[key extends keyof Exclude<T, Nil> ? key : never],
  S,
  ParentKeys,
  IsUndefined extends true
    ? true
    : [Extract<T, Nil>] extends [never]
      ? false
      : true,
  false
>;

type ProcessPaginatedStorageScope<
  T,
  S extends LoadableState,
  ParentKeys extends PrimitiveOrNested[],
  IsUndefined extends boolean = false,
  IsRoot extends boolean = true,
> =
  IsAny<T> extends true
    ? AnyScope<PaginatedStateStorage<S, ParentKeys>>
    : Exclude<T, Nil> extends Primitive
      ? EndOfScope<
          PaginatedStateStorage<
            ProcessState<
              UnNestedState<S>,
              T | (IsUndefined extends true ? undefined : never)
            >,
            ParentKeys
          >
        >
      : (Exclude<T, Nil> extends any[]
          ? {
              readonly [key in ToIndex<
                keyof Exclude<T, Nil>
              >]-?: ProcessPaginatedStorageScopeItem<
                T,
                S,
                ParentKeys,
                key,
                IsUndefined
              >;
            }
          : {
              readonly [key in keyof Exclude<
                T,
                Nil
              >]-?: ProcessPaginatedStorageScopeItem<
                T,
                S,
                ParentKeys,
                key,
                IsUndefined
              >;
            }) &
          EndOfScope<
            PaginatedStateStorage<
              ProcessState<
                S,
                T | (IsUndefined extends true ? undefined : never)
              >,
              ParentKeys
            >,
            IsRoot
          >;

/**
 * Represents a paginated state storage system for managing state entries across multiple pages.
 */
export type PaginatedStateStorage<
  T extends LoadableState,
  ParentKeys extends PrimitiveOrNested[] = [],
> = StorageKeys<ParentKeys> &
  /** @internal */
  Internal<PaginatedStorageUtils> &
  /** @internal */
  InternalPathBase &
  StateStorageMarker<number, T> & {
    /** Retrieves a state entry for the specified page number within the paginated storage. */
    get(
      page: number
    ): StateWithNestedStorageKeys<T, [...ParentKeys, page: number]>;
    /**
     * Deletes a state entry for the specified page number from the paginated storage.
     *
     * **Warning**: This is an unsafe method. It only removes the state entry from
     * the storage but does not clear or reset the state itself.
     */
    delete(page: number): void;
    /**
     * A hook that retrieves an tuple of items and errors for the specified {@link count} of pages in the paginated storage.
     * @param count - The number of pages to retrieve starting from the first page.
     *
     * @example
     * ```js
     * const [items, errors] = paginatedStorage.usePages(5);
     * ```
     */
    usePages(
      count: number
    ): T extends LoadableState<infer V, infer E>
      ? readonly [
          items: ReadonlyArray<V | undefined>,
          errors: ReadonlyArray<E | undefined>,
        ]
      : never;
    /**
     * A hook that retrieves an tuple of items and errors for the specified range of pages in the paginated storage.
     * @param from - The starting page number (starts from `0`).
     * @param to - The ending page number.
     *
     * @example
     * ```js
     * const [items, errors] = paginatedStorage.usePages(2, 5);
     * ```
     */
    usePages(
      from: number,
      to: number
    ): T extends LoadableState<infer V, infer E>
      ? readonly [
          items: ReadonlyArray<V | undefined>,
          errors: ReadonlyArray<E | undefined>,
        ]
      : never;
  } & (T extends StateScope<() => any>
    ? StateScope<
        () => ProcessPaginatedStorageScope<
          T extends LoadableState<infer V> ? V : never,
          T,
          ParentKeys
        >
      >
    : {});

export type WithInitModule<T, Args extends any[]> = [
  ...Args,
  stateInitializer?: StateInitializer<T>,
];

export type StateInitializer<T = any> = (
  keys: PrimitiveOrNested[] | undefined
) => {
  set(value: T): void;
  get(): T | undefined;
  observe?(setState: (value: T) => void): () => void;
};

export type ContainerType =
  | ComponentType<PropsWithChildren>
  | keyof JSX.IntrinsicElements;
