import type { Primitive, PrimitiveOrNested } from 'keyweaver';
import type { $tate } from './utils/constants';

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
      readonly keys: Readonly<Keys>;
    };

export type Internal<T> = {
  /** @internal */
  readonly _internal: T;
};

declare class StateBase {}

export type State<
  Value = unknown,
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

/** State that supports asynchronous operations, extends {@link State} */
export type AsyncState<
  Value = unknown,
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

export type LoadableState<
  Value = unknown,
  Error = any,
  Keys extends PrimitiveOrNested[] = [],
> = AsyncState<Value, Error, Keys> & {
  /** @internal */
  readonly _withoutLoading?: true;
  load(force?: boolean): () => void;
};

export type ControllableLoadableState<
  Value = any,
  Error = any,
  Keys extends PrimitiveOrNested[] = [],
> = LoadableState<Value, Error, Keys> & {
  readonly loading: {
    pause(): void;
    resume(): void;
    reset(): void;
  };
};

export type InternalPathBase = {
  /** @internal */
  readonly _path?: readonly string[];
};

export type StateScope<Scope extends () => any> = {
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

export type NestedState<
  Value = unknown,
  Keys extends PrimitiveOrNested[] = [],
> = State<Value, Keys> &
  StateScope<() => ProcessStateScope<Value, Keys, State, NestedState>>;

export type AsyncNestedState<
  Value = unknown,
  Error = any,
  Keys extends PrimitiveOrNested[] = [],
> = AsyncState<Value, Error, Keys> &
  StateScope<
    () => ProcessStateScope<Value, Keys, AsyncState, AsyncNestedState>
  >;

export type LoadableNestedState<
  Value = unknown,
  Error = any,
  Keys extends PrimitiveOrNested[] = [],
> = LoadableState<Value, Error, Keys> &
  StateScope<
    () => ProcessStateScope<Value, Keys, LoadableState, LoadableNestedState>
  >;

export type ControllableLoadableNestedState<
  Value = unknown,
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

export type AsyncStateOptions<T, Keys extends PrimitiveOrNested[] = []> = {
  value?: ResolvedValue<T> | ((...keys: Keys) => ResolvedValue<T>);
  isLoaded?(
    value: ResolvedValue<T>,
    prevValue: ResolvedValue<T> | undefined,
    attempt: number
  ): boolean;
};

export type LoadableStateOptions<
  T,
  E = any,
  Keys extends PrimitiveOrNested[] = [],
> = AsyncStateOptions<T, Keys> & {
  load(this: AsyncState<T, E>, ...keys: Keys): void | (() => void);
  loadingTimeout?: number;
  reloadIfStale?: number;
  reloadOnFocus?: number;
};

export type ControllableLoadableStateOptions<
  T,
  E = any,
  Keys extends PrimitiveOrNested[] = [],
> = LoadableStateOptions<T, E, Keys> & {
  pause(): void;
  resume(): void;
  reset(): void;
};

export type RequestableStateOptions<
  T,
  E = any,
  Keys extends PrimitiveOrNested[] = [],
> = Pick<
  LoadableStateOptions<T, Keys>,
  'value' | 'loadingTimeout' | 'reloadIfStale' | 'reloadOnFocus'
> & {
  /** @internal */
  _beforeLoad?(args: PrimitiveOrNested[], utils: AsyncState['_internal']): void;
  /** @internal */
  _afterLoad?(
    args: PrimitiveOrNested[] | void,
    utils: AsyncState['_internal']
  ): Promise<PrimitiveOrNested[] | void>;
  load(...args: Keys): Promise<ResolvedValue<T>>;
  shouldRetryOnError?(err: E, attempt: number): number;
};

export type PollableStateOptions<
  T,
  E = any,
  Keys extends PrimitiveOrNested[] = [],
> = RequestableStateOptions<T, E, Keys> &
  Pick<AsyncStateOptions<T>, 'isLoaded'> & {
    interval: number;
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

export type PaginatedStateStorage<
  T extends LoadableState,
  ParentKeys extends PrimitiveOrNested[] = [],
> = StorageKeys<ParentKeys> &
  /** @internal */
  Internal<PaginatedStorageUtils> &
  /** @internal */
  InternalPathBase &
  StateStorageMarker<number, T> & {
    get(
      page: number
    ): StateWithNestedStorageKeys<T, [...ParentKeys, page: number]>;
    delete(page: number): void;
    usePages(
      count: number
    ): T extends LoadableState<infer V, infer E>
      ? readonly [
          items: ReadonlyArray<V | undefined>,
          errors: ReadonlyArray<E | undefined>,
        ]
      : never;
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

export type StateInitializer<T = unknown> = (
  keys: PrimitiveOrNested[] | undefined
) => {
  set(value: T): void;
  get(): T | undefined;
  observe?(setState: (value: T) => void): () => void;
};
