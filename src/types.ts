import type { PrimitiveOrNested } from 'keyweaver';

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
  readonly _parent?: StateCallbackMap;
};

export type StateInternalUtils = {
  _value: any;
  _set(nextValue: any, path: PathKey[], isError?: boolean): void;
  _get(path: PathKey[]): any;
  _onValueChange(cb: (value: any) => void, path: PathKey[]): () => void;
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
  _isLoaded(value: any, prevValue: any): boolean;
  _commonSet: StateInternalUtils['_set'];
  _slowLoading: {
    _handle(isLoadedUtils: StateInternalUtils): void;
    _timeout: number;
    _timeoutId: ReturnType<typeof setTimeout> | undefined;
    _callbackSet: Set<() => void>;
  } | null;
  _load: (() => (() => void) | void) | undefined;
  _counter: number;
  _isLoadable: boolean;
  _isFetchInProgress: boolean;
  readonly _errorUtils: ErrorStateUtils & StateInternalUtils;
  readonly _isLoadedUtils: StateInternalUtils;
  _promise: {
    _promise: Promise<any>;
    _resolve(value: any): void;
    _reject(error: any): void;
  } | null;
  _unload: (() => void) | void | undefined;
};

export type AsyncState<
  Value = unknown,
  Error = any,
  Keys extends PrimitiveOrNested[] = [],
> = State<Value | typeof PENDING, Keys> &
  /** @internal */
  Internal<AsyncStateUtils> & {
    /** @internal */
    readonly _awaitOnly?: true;
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
  /** @internal */
  readonly _withoutLoading?: true;
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

export type ExtractValues<
  T extends Array<AsyncState<any> | Falsy>,
  Nullable extends boolean = false,
> = Readonly<{
  [index in keyof T]: T[index] extends AsyncState<infer K>
    ? K | (Nullable extends false ? never : undefined)
    : undefined;
}>;

export type ExtractErrors<T extends Array<AsyncState<any> | Falsy>> = Readonly<{
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

type StorageItem = State<any> | StateStorageMarker<PrimitiveOrNested, any>;

type ProcessStorageItem<
  T extends StorageItem,
  Keys extends PrimitiveOrNested[],
> =
  T extends State<ResolvedValue<infer V>>
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
  readonly _pages: Set<number>;
  _resolvePage(page: number): void;
  _promise: Promise<void>;
  _resolve(): void;
  _shouldRevalidate(state: LoadableState<any>): boolean;
};

type GetNestedPathState<T, P extends PathKey[]> =
  RetrieveState<T> extends infer S
    ? S extends State<ResolvedValue<infer V>>
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
  } & (T extends StatePath<(...path: any) => any>
    ? StatePath<{
        <
          P extends ObjectPath<
            RetrieveState<T> extends State<infer V> ? ResolvedValue<V> : never
          >,
        >(
          ...path: P
        ): StateStorage<
          K,
          NestedStateStorage<KeysOfStorage<T>, GetNestedPathState<T, P>>,
          ParentKeys
        >;
      }>
    : {});

export type PaginatedStateStorage<
  T extends LoadableState<any>,
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
  } & (T extends StatePath<(...path: any) => any>
    ? StatePath<{
        <
          P extends ObjectPath<
            T extends State<infer V> ? ResolvedValue<V> : never
          >,
        >(
          ...path: P
        ): PaginatedStateStorage<GetNestedPathState<T, P>, ParentKeys>;
      }>
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
