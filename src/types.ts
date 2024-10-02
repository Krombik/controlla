import type { PrimitiveOrNested } from 'keyweaver';
import type { RootKey } from './utils/constants';

export type PathKey = number | string;

declare const PENDING: unique symbol;

export type ResolvedValue<Value> = Exclude<Value, typeof PENDING>;

export type HandlePending<Value> = [Extract<Value, typeof PENDING>] extends [
  never,
]
  ? Value
  : ResolvedValue<Value> | undefined;

type ResolvePath<K, Path, O = ResolvedValue<K>> = Path extends [
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

type ObjectPath<K, O = ResolvedValue<K>> = O extends any[] | Record<any, any>
  ? RecursivePath<Required<O>, O extends any[] ? ArrayIndexes<O> : keyof O>
  : [];

type Nil = null | undefined;

export type Falsy = Nil | false | 0 | '';

export type ValueChangeCallbacks = Set<(value: any) => void>;

export type StateCallbackMap = {
  _root: ValueChangeCallbacks | null;
  _children: Map<PathKey, StateCallbackMap> | null;
  _parent?: StateCallbackMap;
};

export type StateDataMap = Map<RootKey.VALUE, any> &
  Map<RootKey.PROMISE, Promise<any>> &
  Map<RootKey.PROMISE_RESOLVE, (value: any) => void> &
  Map<RootKey.PROMISE_REJECT, (error: any) => void> &
  Map<RootKey.SLOW_LOADING_TIMEOUT_ID, ReturnType<typeof setTimeout>> &
  Map<RootKey.UNLOAD, () => void> &
  Map<RootKey.STABLE_VALUE, any>;

export type StateInternalUtils = {
  _data: StateDataMap;
  _set(nextValue: any, isSet: boolean, path: PathKey[], isError: boolean): void;
  _get(value: any, path: PathKey[]): any;
  _onValueChange(cb: (value: any) => void, path: PathKey[]): () => void;
};

declare const STATE_IDENTIFIER: unique symbol;

type Nesting<Keys extends PrimitiveOrNested[]> = Keys['length'] extends 0
  ? {}
  : {
      readonly keys: Readonly<Keys>;
    };

export type Internal<T> = {
  /** @internal */
  readonly _internal: T;
};

declare class KeepTogether {
  private readonly O_o?: never;
}

export type State<
  Value = unknown,
  Keys extends PrimitiveOrNested[] = [],
> = KeepTogether & {
  readonly [STATE_IDENTIFIER]: Value;
  /** @internal */
  readonly _anchor?: Readonly<{}>;
} & Nesting<Keys> &
  /** @internal */
  Internal<StateInternalUtils> &
  /** @internal */
  Partial<Nesting<any[]>> &
  /** @internal */
  InternalPathBase;

export type ErrorStateUtils = {
  _parentUtils: StateInternalUtils;
  _commonSet: StateInternalUtils['_set'];
};

export type AsyncStateUtils = {
  _isLoaded(value: any, prevValue: any): boolean;
  _commonSet: StateInternalUtils['_set'];
  _handleSlowLoading(): void;
  _slowLoadingTimeout?: number;
  _slowLoadingCallbackSet?: Set<() => void>;
  _load?(): (() => void) | void;
  _counter: number;
  _isLoadable: boolean;
  _isFetchInProgress: boolean;
  _errorUtils: ErrorStateUtils & StateInternalUtils;
  _isLoadedUtils: StateInternalUtils;
};

export type AsyncState<
  Value = unknown,
  Error = any,
  Keys extends PrimitiveOrNested[] = [],
> = State<Value | typeof PENDING, Keys> &
  /** @internal */
  Internal<AsyncStateUtils> & {
    readonly error: State<Error | undefined> &
      /** @internal */
      Internal<ErrorStateUtils>;
    readonly isLoaded: State<boolean>;
  };

export type LoadableState<
  Value = unknown,
  Error = any,
  Keys extends PrimitiveOrNested[] = [],
> = AsyncState<Value, Error, Keys> & {
  load(force?: boolean): () => void;
};

export type ControllableLoadableState<
  Value = any,
  Error = any,
  Keys extends PrimitiveOrNested[] = [],
> = LoadableState<Value, Error, Keys> & {
  pause(): void;
  resume(): void;
  reset(): void;
};

export type InternalPathBase = {
  /** @internal */
  readonly _path?: PathKey[];
};

export type StatePath<Path extends (...path: any[]) => any> = {
  path: Path;
};

export type NestedState<Value, Keys extends PrimitiveOrNested[] = []> = State<
  Value,
  Keys
> &
  StatePath<{
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
  StatePath<{
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
  StatePath<{
    <P extends ObjectPath<Value>, T = ResolvePath<Value, P>>(
      ...path: P
    ): [] extends Required<ObjectPath<T>>
      ? LoadableState<T, Error, Keys>
      : LoadableNestedState<T, Error, Keys>;
  }>;

export type ControllableLoadableNestedState<
  Value,
  Error = any,
  Keys extends PrimitiveOrNested[] = [],
> = ControllableLoadableState<Value, Error, Keys> &
  StatePath<{
    <P extends ObjectPath<Value>, T = ResolvePath<Value, P>>(
      ...path: P
    ): [] extends Required<ObjectPath<T>>
      ? ControllableLoadableState<T, Error, Keys>
      : ControllableLoadableNestedState<T, Error, Keys>;
  }>;

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

export type ExtractValues<T> = Readonly<
  T extends [infer Head, ...infer Tail]
    ? [
        Head extends AsyncState<infer K> ? ResolvedValue<K> : undefined,
        ...ExtractValues<Tail>,
      ]
    : []
>;

export type ExtractError<T> = T extends [infer Head, ...infer Tail]
  ? (Head extends AsyncState<any, infer K> ? K : never) | ExtractError<Tail>
  : never;

export type AsyncStateOptions<T, Keys extends PrimitiveOrNested[] = []> = {
  value?: ResolvedValue<T> | ((...keys: Keys) => ResolvedValue<T>);
  isLoaded?(
    value: ResolvedValue<T>,
    prevValue: ResolvedValue<T> | undefined
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

type StorageKeys<T, Acc extends PrimitiveOrNested[] = []> =
  T extends StateStorageMarker<infer Key extends PrimitiveOrNested, infer Item>
    ? StorageKeys<Item, [...Acc, Key]>
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

type StorageItem = State<any> | StateStorageMarker<PrimitiveOrNested, any>;

type ProcessStorageItem<
  T extends StorageItem,
  Keys extends PrimitiveOrNested[],
> =
  T extends State<infer V>
    ? T extends ControllableLoadableNestedState<any, infer E>
      ? ControllableLoadableNestedState<V, E, Keys>
      : T extends ControllableLoadableState<any, infer E>
        ? ControllableLoadableState<V, E, Keys>
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
  _pages: Set<number>;
  _resolvePage(page: number): void;
  _promise: Promise<void>;
  _resolve(): void;
  _shouldRevalidate(state: LoadableState<any>): boolean;
};

type GetNestedPathState<T, P extends PathKey[]> =
  RetrieveState<T> extends infer S
    ? S extends State<infer V>
      ? ResolvePath<V, P> extends infer V
        ? ObjectPath<V> extends infer P
          ? S extends ControllableLoadableState<any, infer E>
            ? [] extends Required<P>
              ? ControllableLoadableState<V, E>
              : ControllableLoadableNestedState<V, E>
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
  /** @internal */
  Internal<StorageUtils> &
  /** @internal */
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
  } & (T extends StatePath<(...path: any) => any>
    ? StatePath<{
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
  } & (T extends StatePath<(...path: any) => any>
    ? StatePath<{
        <P extends ObjectPath<T extends State<infer V> ? V : never>>(
          ...path: P
        ): PaginatedStateStorage<GetNestedPathState<T, P>, ParentKeys>;
      }>
    : {});

export type WithInitModule<T, Args extends any[]> = [
  ...Args,
  initModule?: InitModule<T>,
];

export type InitModule<T = unknown> = (
  keys: PrimitiveOrNested[] | undefined
) => StateModule<T>;

export type StateModule<T = unknown> = {
  set(value: T): void;
  get(): T | undefined;
  register?(setState: (value: T) => void): () => void;
};
