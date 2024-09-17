import type { PrimitiveOrNested } from 'keyweaver';
import type { RootKey } from './utils/constants';

export type Key = number | string;

declare const PENDING: unique symbol;

export type Pending = typeof PENDING;

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

export type NestedMap = Map<[], CallbackRegistry> & Map<Key, NestedMap>;

export type NestedStorageKeys<Keys extends PrimitiveOrNested[]> = {
  readonly a: Keys;
};

/** @internal */
export type InternalDataMap = Map<RootKey.VALUE, any> &
  Map<RootKey.PROMISE, Promise<any>> &
  Map<RootKey.PROMISE_RESOLVE, (value: any) => void> &
  Map<RootKey.PROMISE_REJECT, (error: any) => void> &
  Map<RootKey.SLOW_LOADING_TIMEOUT_ID, ReturnType<typeof setTimeout>> &
  Map<RootKey.UNLOAD, () => void>;

/** @internal */
export type InternalUtils = {
  readonly _data: InternalDataMap;
  _set(nextValue: any, isSet: boolean, path: Key[], isError: boolean): void;
  _get(value: any, path: Key[]): any;
  _getValueChangeCallbackSet(path: Key[]): CallbackRegistry;
};

declare const HIDDEN: unique symbol;

type Nesting<Keys extends PrimitiveOrNested[]> = Keys['length'] extends 0
  ? {}
  : {
      readonly keys: Readonly<Keys>;
    };

export type State<Value = unknown, Keys extends PrimitiveOrNested[] = []> = {
  [HIDDEN]?: Value;
  /** @internal */
  readonly _internal: InternalUtils;
} & Nesting<Keys> &
  /** @internal */
  Partial<Nesting<any[]>> &
  /** @internal */
  Partial<PathBase<any>>;

type ErrorInternalUtils = InternalUtils & {
  readonly _parentUtils: InternalUtils;
  _commonSet: InternalUtils['_set'];
};

export type AsyncState<
  Value = unknown,
  Error = any,
  Keys extends PrimitiveOrNested[] = [],
> = State<Value | Pending, Keys> & {
  /** @internal */
  _internal: InternalUtils & {
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
  };
  readonly error: State<Error | undefined> & {
    /** @internal */
    _internal: ErrorInternalUtils;
  };
  readonly isLoaded: State<boolean>;
};

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

export type PathBase<Path extends (...path: any[]) => any> = {
  /** @internal */
  readonly _path: Key[];
  path: Path;
};

export type NestedState<Value, Keys extends PrimitiveOrNested[] = []> = State<
  Value,
  Keys
> &
  PathBase<{
    <P extends ObjectPath<Value>, T = ResolvePath<Value, P>>(
      ...path: P
    ): [] extends ObjectPath<T> ? State<T, Keys> : NestedState<T, Keys>;
  }>;

export type AsyncNestedState<
  Value,
  Error = any,
  Keys extends PrimitiveOrNested[] = [],
> = AsyncState<Value, Error, Keys> &
  PathBase<{
    <P extends ObjectPath<Value>, T = ResolvePath<Value, P>>(
      ...path: P
    ): [] extends ObjectPath<T>
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
    ): [] extends ObjectPath<T>
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
    ): [] extends ObjectPath<T>
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

type Nested<T, P extends any[]> =
  T extends StateBase<infer Value, infer Type>
    ? NestedStateWrapper<
        StateBase<ResolvePath<Value, P>, Type> &
          (T extends NestedStorageKeys<infer Keys>
            ? NestedStorageKeys<Keys>
            : {}) &
          (T extends ErrorBase<infer Error> ? ErrorBase<Error> : {})
      >
    : never;

interface StatePathResolver<Value> extends StatePath {
  path<P extends ObjectPath<Value>>(...path: P): Nested<this, P>;
}

type NestedStateWrapper<T> = T &
  (T extends StateBase<infer Value, string>
    ? ObjectPath<Value> extends []
      ? {}
      : StatePathResolver<Value>
    : never);

export type ExtractValues<T> = T extends [infer Head, ...infer Tail]
  ? [
      Head extends AnyAsyncState<infer K> ? Exclude<K, Pending> : undefined,
      ...ExtractValues<Tail>,
    ]
  : [];

export type AsyncStateOptions<T> = {
  value?: T | (() => T);
  isLoaded?(value: T, prevValue: T | undefined): boolean;
};

export type LoadableStateOptions<T, E = any> = AsyncStateOptions<T> & {
  load(this: AsyncState<T, E>): void | (() => void);
  loadingTimeout?: number;
};

export type ControllableStateOptions<T, E = any> = LoadableStateOptions<
  T,
  E
> & {
  pause(): void;
  resume(): void;
  reset(): void;
};

export type RequestableStateOptions<
  T,
  E = any,
  Keys extends PrimitiveOrNested[] = [],
> = Pick<LoadableStateOptions<T>, 'value' | 'loadingTimeout'> & {
  /** @internal */
  _beforeLoad?(args: PrimitiveOrNested[], state: StateBase<any, any>): void;
  /** @internal */
  _afterLoad?(
    args: PrimitiveOrNested[] | void
  ): Promise<PrimitiveOrNested[] | void>;
  load(...args: Keys[]): Promise<T>;
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
  T extends StateStorage<infer Key extends PrimitiveOrNested, infer Item, any[]>
    ? StorageKeys<Item, [...Acc, Key]>
    : Acc;

type StateWithNestedStorageKeys<T, Keys extends PrimitiveOrNested[]> =
  T extends Record<any, StateBase<any, any>>
    ? {
        [key in keyof T]: StateWithNestedStorageKeys<T[key], Keys>;
      }
    : T extends StateBase<infer Value, infer Type>
      ? StateBase<Value, Type> &
          (T extends ErrorBase<infer Error> ? ErrorBase<Error> : {}) &
          (ObjectPath<Value> extends [] ? {} : StatePathResolver<Value>) &
          NestedStorageKeys<Keys>
      : T extends StateStorage<infer K, infer S, any[]>
        ? StateStorage<K, S, Keys>
        : never;

type RetrieveChildState<T, Keys extends PrimitiveOrNested[]> = Keys extends [
  infer Head extends PrimitiveOrNested,
  ...infer Tail extends PrimitiveOrNested[],
]
  ? T extends StateStorage<Head, infer Item, any[]>
    ? RetrieveChildState<Item, Tail>
    : T
  : T;

type RetrieveState<T> =
  T extends StateStorage<any, infer Child, any[]> ? RetrieveState<Child> : T;

export type NestedStateStorage<
  Keys extends PrimitiveOrNested[],
  T,
> = Keys extends [
  ...infer Head extends PrimitiveOrNested[],
  infer Tail extends PrimitiveOrNested,
]
  ? NestedStateStorage<Head, StateStorage<Tail, T, Head>>
  : T;

export type StateStorage<
  K extends PrimitiveOrNested,
  T,
  ParentKeys extends PrimitiveOrNested[] = [],
> = StatePath &
  NestedStorageKeys<ParentKeys> & {
    /** @internal */
    _get(keys: any[], index: number): RetrieveChildState<T, [any]>;
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
  } & (T extends { path(...args: any[]): any }
    ? {
        path<
          P extends ObjectPath<
            RetrieveState<T> extends StateBase<infer V, string> ? V : never
          >,
        >(
          ...path: P
        ): StateStorage<
          K,
          NestedStateStorage<StorageKeys<T>, Nested<RetrieveState<T>, P>>,
          ParentKeys
        >;
      }
    : {});
