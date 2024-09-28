import type { PrimitiveOrNested } from 'keyweaver';
import type { RootKey } from './utils/constants';

export type Key = number | string;

declare const PENDING: unique symbol;

export type Pending = typeof PENDING;

export type WithoutPending<Value> = Exclude<Value, Pending>;

export type HandlePending<Value> = [Extract<Value, Pending>] extends [never]
  ? Value
  : Exclude<Value, Pending> | undefined;

type ResolvePath<K, Path, O = Exclude<K, Pending>> = Path extends [
  infer Key,
  ...infer Rest,
]
  ? Key extends keyof NonNullable<O>
    ? ResolvePath<
        | NonNullable<O>[Key]
        | ([Extract<O, null | undefined>] extends [never] ? never : undefined),
        Rest
      >
    : never
  : O;

type StringToNumber<T> = T extends `${infer K extends number}` ? K : never;

type ArrayIndexes<T extends any[]> = T extends [infer _, ...any[]]
  ? StringToNumber<Exclude<keyof T, keyof []>>
  : number;

type RecursivePath<O, K extends keyof O> = [] extends O
  ? []
  : {
      [Key in K]: Partial<[Key, ...ObjectPath<O[Key]>]>;
    }[K];

type ObjectPath<K, O = Exclude<K, Pending>> = O extends any[] | Record<any, any>
  ? RecursivePath<Required<O>, O extends any[] ? ArrayIndexes<O> : keyof O>
  : [];

type Nill = null | undefined;

export type Falsy = Nill | false | 0 | '';

export type CallbackRegistry = Set<(value: any) => void>;

export type NestedMap = {
  _root: CallbackRegistry | null;
  _children: Map<Key, NestedMap> | null;
  _parent?: NestedMap;
};

/** @internal */
export type InternalDataMap = Map<RootKey.VALUE, any> &
  Map<RootKey.PROMISE, Promise<any>> &
  Map<RootKey.PROMISE_RESOLVE, (value: any) => void> &
  Map<RootKey.PROMISE_REJECT, (error: any) => void> &
  Map<RootKey.SLOW_LOADING_TIMEOUT_ID, ReturnType<typeof setTimeout>> &
  Map<RootKey.UNLOAD, () => void> &
  Map<RootKey.STABLE_VALUE, any>;

/** @internal */
export type InternalUtils = {
  readonly _data: InternalDataMap;
  _set(nextValue: any, isSet: boolean, path: Key[], isError: boolean): void;
  _get(value: any, path: Key[]): any;
  _onValueChange(cb: (value: any) => void, path: Key[]): () => void;
};

declare const STATE_MARKER: unique symbol;

export type Nesting<Keys extends PrimitiveOrNested[]> = Keys['length'] extends 0
  ? {}
  : {
      readonly keys: Readonly<Keys>;
    };

/** @internal */
export type Internal<T> = {
  /** @internal */
  _internal: T;
};

export type State<Value = unknown, Keys extends PrimitiveOrNested[] = []> = {
  readonly [STATE_MARKER]: Value;
} & Nesting<Keys> &
  /** @internal */
  Internal<InternalUtils> &
  /** @internal */
  Partial<Nesting<any[]>> &
  /** @internal */
  InternalPathBase;

type ErrorInternalUtils = InternalUtils & {
  readonly _parentUtils: InternalUtils;
  _commonSet: InternalUtils['_set'];
};

export type AsyncState<
  Value = unknown,
  Error = any,
  Keys extends PrimitiveOrNested[] = [],
> = State<Value | Pending, Keys> & {
  readonly error: State<Error | undefined> & Internal<ErrorInternalUtils>;
  readonly isLoaded: State<boolean>;
} & Internal<{
    _isLoaded(value: any, prevValue: any): boolean;
    _commonSet: InternalUtils['_set'];
    _handleSlowLoading(): void;
    _slowLoadingTimeout?: number;
    _slowLoadingCallbackSet?: Set<() => void>;
    _load?(): (() => void) | void;
    _counter: number;
    _isLoadable: boolean;
    _isFetchInProgress: boolean;
    _errorUtils: ErrorInternalUtils;
    _isLoadedUtils: InternalUtils;
  }>;

export type LoadableState<
  Value = unknown,
  Error = any,
  Keys extends PrimitiveOrNested[] = [],
> = AsyncState<Value, Error, Keys> & {
  load(force?: boolean): () => void;
};

export type ControllableState<
  Value = any,
  Error = any,
  Keys extends PrimitiveOrNested[] = [],
> = LoadableState<Value, Error, Keys> & {
  pause(): void;
  resume(): void;
  reset(): void;
};

/** @internal */
export type InternalPathBase = {
  /** @internal */
  readonly _path?: Key[];
};

export type PathBase<Path extends (...path: any[]) => any> = {
  path: Path;
};

export type NestedState<Value, Keys extends PrimitiveOrNested[] = []> = State<
  Value,
  Keys
> &
  PathBase<{
    <P extends ObjectPath<Value>, T = ResolvePath<Value, P>>(
      ...path: P
    ): [] extends Required<ObjectPath<T>>
      ? State<T, Keys>
      : NestedState<T, Keys>;
  }>;

export type AsyncNestedState<
  Value,
  Error = any,
  Keys extends PrimitiveOrNested[] = [],
> = AsyncState<Value, Error, Keys> &
  PathBase<{
    <P extends ObjectPath<Value>, T = ResolvePath<Value, P>>(
      ...path: P
    ): [] extends Required<ObjectPath<T>>
      ? AsyncState<T, Error, Keys>
      : AsyncNestedState<T, Error, Keys>;
  }>;

export type LoadableNestedState<
  Value,
  Error = any,
  Keys extends PrimitiveOrNested[] = [],
> = LoadableState<Value, Error, Keys> &
  PathBase<{
    <P extends ObjectPath<Value>, T = ResolvePath<Value, P>>(
      ...path: P
    ): [] extends Required<ObjectPath<T>>
      ? LoadableState<T, Error, Keys>
      : LoadableNestedState<T, Error, Keys>;
  }>;

export type ControllableNestedState<
  Value,
  Error = any,
  Keys extends PrimitiveOrNested[] = [],
> = ControllableState<Value, Error, Keys> &
  PathBase<{
    <P extends ObjectPath<Value>, T = ResolvePath<Value, P>>(
      ...path: P
    ): [] extends Required<ObjectPath<T>>
      ? ControllableState<T, Error, Keys>
      : ControllableNestedState<T, Error, Keys>;
  }>;

export type AnyState<Value = any, Keys extends PrimitiveOrNested[] = []> =
  | State<Value, Keys>
  | AsyncState<Value, any, Keys>
  | LoadableState<Value, any, Keys>
  | ControllableState<Value, any, Keys>;

export type AnyAsyncState<
  Value = any,
  Error = any,
  Keys extends PrimitiveOrNested[] = [],
> =
  | AsyncState<Value, Error, Keys>
  | LoadableState<Value, Error, Keys>
  | ControllableState<Value, Error, Keys>;

export type AnyLoadableState<
  Value = any,
  Error = any,
  Keys extends PrimitiveOrNested[] = [],
> = LoadableState<Value, Error, Keys> | ControllableState<Value, Error, Keys>;

export type ExtractValues<T> = T extends [infer Head, ...infer Tail]
  ? [
      Head extends AnyAsyncState<infer K> ? WithoutPending<K> : undefined,
      ...ExtractValues<Tail>,
    ]
  : [];

export type AsyncStateOptions<T, Keys extends PrimitiveOrNested[] = []> = {
  value?: WithoutPending<T> | ((...keys: Keys) => WithoutPending<T>);
  isLoaded?(
    value: WithoutPending<T>,
    prevValue: WithoutPending<T> | undefined
  ): boolean;
};

export type LoadableStateOptions<
  T,
  E = any,
  Keys extends PrimitiveOrNested[] = [],
> = AsyncStateOptions<T, Keys> & {
  load(this: AsyncState<T, E>, ...keys: Keys): void | (() => void);
  loadingTimeout?: number;
};

export type ControllableStateOptions<
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
> = Pick<LoadableStateOptions<T, Keys>, 'value' | 'loadingTimeout'> & {
  /** @internal */
  _beforeLoad?(
    args: PrimitiveOrNested[],
    utils: AsyncState<any>['_internal']
  ): void;
  /** @internal */
  _afterLoad?(
    args: PrimitiveOrNested[] | void,
    utils: AsyncState<any>['_internal']
  ): Promise<PrimitiveOrNested[] | void>;
  load(...args: Keys): Promise<WithoutPending<T>>;
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

export type StorageKeys<T, Acc extends PrimitiveOrNested[] = []> =
  T extends StateStorageMarker<infer Key extends PrimitiveOrNested, infer Item>
    ? StorageKeys<Item, [...Acc, Key]>
    : Acc;

type StorageItem = State<any> | StateStorage<PrimitiveOrNested, any>;

type ProcessStorageItem<
  T extends StorageItem,
  Keys extends PrimitiveOrNested[],
> =
  T extends State<infer V>
    ? T extends ControllableNestedState<any, infer E>
      ? ControllableNestedState<V, E, Keys>
      : T extends ControllableState<any, infer E>
        ? ControllableState<V, E, Keys>
        : T extends LoadableNestedState<any, infer E>
          ? LoadableNestedState<V, E, Keys>
          : T extends LoadableState<any, infer E>
            ? LoadableState<V, E, Keys>
            : T extends AsyncNestedState<any, infer E>
              ? AsyncNestedState<V, E, Keys>
              : T extends AsyncState<any, infer E>
                ? AsyncState<V, E, Keys>
                : T extends NestedState<any>
                  ? NestedState<V, Keys>
                  : State<V, Keys>
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

export type RetrieveState<T> =
  T extends StateStorageMarker<any, infer Child> ? RetrieveState<Child> : T;

export type NestedStateStorage<
  Keys extends PrimitiveOrNested[],
  T,
> = Keys extends [
  ...infer Head extends PrimitiveOrNested[],
  infer Tail extends PrimitiveOrNested,
]
  ? NestedStateStorage<Head, StateStorage<Tail, T, Head>>
  : T;

export declare const STATE_STORAGE_MARKER: unique symbol;

type StateStorageMarker<Key extends PrimitiveOrNested, Item> = {
  [STATE_STORAGE_MARKER]: [Key, Item];
};

type BasicStorageUtils = {
  _get(key: PrimitiveOrNested, keys: readonly PrimitiveOrNested[]): any;
  readonly _storage: Map<any, any>;
  _getItem(options: any, args: any[]): any;
  readonly _options: any;
};

export type StorageUtils = BasicStorageUtils & {
  _keyStorage?: Map<string, any>;
  readonly _depth: number;
};

export type PaginatedStorageUtils = BasicStorageUtils & {
  _pages: Set<number>;
  _resolvePage(page: number): void;
  _promise: Promise<void>;
  _resolve(): void;
  _shouldRevalidate(state: LoadableState<any>): boolean;
};

type GetNestedPathState<T, P extends Key[]> =
  RetrieveState<T> extends infer S
    ? S extends State<infer V>
      ? ResolvePath<V, P> extends infer V
        ? ObjectPath<V> extends infer P
          ? S extends ControllableState<any, infer E>
            ? [] extends Required<P>
              ? ControllableState<V, E>
              : ControllableNestedState<V, E>
            : S extends LoadableState<any, infer E>
              ? [] extends Required<P>
                ? LoadableState<V, E>
                : LoadableNestedState<V, E>
              : S extends AsyncState<any, infer E>
                ? [] extends Required<P>
                  ? AsyncState<V, E>
                  : AsyncNestedState<V, E>
                : [] extends Required<P>
                  ? State<V>
                  : NestedState<V>
          : never
        : never
      : never
    : never;

export type StateStorage<
  K extends PrimitiveOrNested,
  T,
  ParentKeys extends PrimitiveOrNested[] = [],
> = Nesting<ParentKeys> &
  Internal<StorageUtils> &
  InternalPathBase &
  StateStorageMarker<K, T> & {
    get<Keys extends [K, ...Partial<StorageKeys<T>>]>(
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
  } & (T extends PathBase<(...path: any) => any>
    ? PathBase<{
        <
          P extends ObjectPath<
            RetrieveState<T> extends State<infer V> ? V : never
          >,
        >(
          ...path: P
        ): StateStorage<
          K,
          NestedStateStorage<StorageKeys<T>, GetNestedPathState<T, P>>,
          ParentKeys
        >;
      }>
    : {});

export type PaginatedStateStorage<
  T extends LoadableState<any>,
  ParentKeys extends PrimitiveOrNested[] = [],
> = Nesting<ParentKeys> &
  Internal<PaginatedStorageUtils> &
  InternalPathBase &
  StateStorageMarker<number, T> & {
    get(
      page: number
    ): StateWithNestedStorageKeys<T, [...ParentKeys, page: number]>;
    delete(page: number): void;
    use(page: number): T extends State<infer V> ? V[] : never;
    use(from: number, to: number): T extends State<infer V> ? V[] : never;
  } & (T extends PathBase<(...path: any) => any>
    ? PathBase<{
        <P extends ObjectPath<T extends State<infer V> ? V : never>>(
          ...path: P
        ): PaginatedStateStorage<GetNestedPathState<T, P>, ParentKeys>;
      }>
    : {});

export declare enum StateType {
  STATE,
  ASYNC_STATE,
  REQUESTABLE_STATE,
  POLLABLE_STATE,
  NESTED_STATE,
  NESTED_ASYNC_STATE,
  NESTED_REQUESTABLE_STATE,
  NESTED_POLLABLE_STATE,
}

declare const TYPE: unique symbol;

export type OriginalStateCreator<Fn, T extends StateType> = Fn & {
  [TYPE]: T;
};
