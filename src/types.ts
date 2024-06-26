export type Key = number | string;

export type Get<O, Path> = Path extends [infer Key, ...infer Rest]
  ? Key extends keyof NonNullable<O>
    ? Get<
        | NonNullable<O>[Key]
        | ([Extract<O, null | undefined>] extends [never] ? never : undefined),
        Rest
      >
    : never
  : O;

type ToNumber<T> = T extends `${infer K extends number}` ? K : never;

type Indexes<T extends any[]> = T extends [infer _, ...any[]]
  ? ToNumber<Exclude<keyof T, keyof []>>
  : number;

type NestedPath<O, K extends keyof O> = [] extends O
  ? []
  : {
      [Key in K]: Partial<[Key, ...Path<O[Key]>]>;
    }[K];

export type Path<O> = O extends any[] | Record<any, any>
  ? NestedPath<Required<O>, O extends any[] ? Indexes<O> : keyof O>
  : [];

type Nill = null | undefined;

export type Falsy = Nill | false | 0 | '';

type NillChecker<V, T> = [Extract<V, Nill>] extends [never]
  ? T
  : [Exclude<V, Nill>] extends [never]
    ? undefined
    : T | undefined;

/** @internal */
export type CallbackSet = Set<(value: any) => void>;

/** @internal */
export const enum RootKey {
  VALUE,
  VALUE_GET,
  VALUE_SET,
  VALUE_GET_CALLBACK_SET,
  ERROR,
  ERROR_CALLBACK_SET,
  PROMISE,
  IS_LOADED,
  IS_LOADED_CALLBACK_SET,
  LOAD,
  SLOW_LOADING_CALLBACK_SET,
  PAUSE,
  RESUME,
}

/** @internal */
export type SetKey =
  | RootKey.ERROR_CALLBACK_SET
  | RootKey.IS_LOADED_CALLBACK_SET
  | RootKey.SLOW_LOADING_CALLBACK_SET;

/** @internal */
export type ValueKey = RootKey.VALUE | RootKey.ERROR | RootKey.IS_LOADED;

/** @internal */
export type _SimplifiedState = Partial<BasePath> &
  BaseState<{
    get<K extends RootKey>(
      key: K
    ): K extends SetKey
      ? CallbackSet
      : K extends RootKey.VALUE_GET_CALLBACK_SET
        ? (path: Key[]) => CallbackSet
        : K extends RootKey.LOAD
          ? (arg: any) => Promise<any>
          : any;
    set(key: ValueKey, value: any): void;
    has(key: RootKey): boolean;
  }>;

export type NestedMap = Map<[], CallbackSet> & Map<Key, NestedMap>;

export type Root<Value = any> = Map<
  RootKey.VALUE_GET,
  (rootValue: any, path: Key[]) => Value
> &
  Map<
    RootKey.VALUE_SET,
    (
      nextValue: Value,
      rootValue: any,
      isSet: boolean,
      path: Key[],
      isError: boolean
    ) => void
  > &
  Map<RootKey.VALUE_GET_CALLBACK_SET, (path: Key[]) => CallbackSet> &
  Map<RootKey.VALUE, any>;

/** @internal */
export type Listener = (state: AnyAsyncState) => void | (() => void);

export type AsyncRoot<Value = any, Error = any> = Root<Value> &
  Map<RootKey.ERROR, Error> &
  Map<RootKey.ERROR_CALLBACK_SET, CallbackSet> &
  Map<RootKey.IS_LOADED, boolean> &
  Map<RootKey.IS_LOADED_CALLBACK_SET, CallbackSet> &
  Map<RootKey.PROMISE, Promise<Value>>;

export type LoadableRoot<Value = any, Error = any> = AsyncRoot<Value, Error> &
  Map<RootKey.LOAD, (arg: any, force?: boolean) => () => void> &
  Map<RootKey.SLOW_LOADING_CALLBACK_SET, Set<() => void>>;

export type PausableRoot<Value = any, Error = any> = LoadableRoot<
  Value,
  Error
> &
  Map<RootKey.PAUSE, () => void> &
  Map<RootKey.RESUME, () => void>;

type BaseState<R> = {
  /** root */
  readonly r: R;
  readonly v?: any;
};

type InnerState<R> = BaseState<R> & Partial<BasePath>;

export type AnyState<Value = any> = InnerState<
  Root<Value> | AsyncRoot<Value> | LoadableRoot<Value> | PausableRoot<Value>
>;

export type AnyAsyncState<Value = any, Error = any> = InnerState<
  | AsyncRoot<Value, Error>
  | LoadableRoot<Value, Error>
  | PausableRoot<Value, Error>
>;

export type AnyLoadableAsyncState<Value = any, Error = any> = InnerState<
  LoadableRoot<Value, Error> | PausableRoot<Value, Error>
>;

export type BasePath = {
  /** path */
  readonly p: Key[];
};

export type State<Value = any> = BaseState<Root<Value>>;

export type AsyncState<Value = any, Error = any> = BaseState<
  AsyncRoot<Value, Error>
>;

export type LoadableAsyncState<Value = any, Error = any> = BaseState<
  LoadableRoot<Value, Error>
>;

export type PausableLoadableAsyncState<Value = any, Error = any> = BaseState<
  PausableRoot<Value, Error>
>;

export type NestedState<Value = any> = BasePath &
  BaseState<Root<Value>> & {
    path<P extends Path<Value>>(...path: P): NestedState<Get<Value, P>>;
  };

export type AsyncNestedState<Value = any, Error = any> = BasePath &
  BaseState<AsyncRoot<Value, Error>> & {
    path<P extends Path<Value>>(
      ...path: P
    ): AsyncNestedState<Get<Value, P>, Error>;
  };

export type LoadableAsyncNestedState<Value = any, Error = any> = BasePath &
  BaseState<LoadableRoot<Value, Error>> & {
    path<P extends Path<Value>>(
      ...path: P
    ): LoadableAsyncNestedState<Get<Value, P>, Error>;
  };

export type PausableLoadableAsyncNestedState<
  Value = any,
  Error = any,
> = BasePath &
  BaseState<PausableRoot<Value, Error>> & {
    path<P extends Path<Value>>(
      ...path: P
    ): PausableLoadableAsyncNestedState<Get<Value, P>, Error>;
  };

export type VersionedState<Version, Value = any> = {
  of<V extends Version | Nill>(version: V): NillChecker<V, State<Value>>;
};

export type VersionedAsyncState<Version, Value = any, Error = any> = {
  of<V extends Version | Nill>(
    version: V
  ): NillChecker<V, AsyncState<Value, Error>>;
};

export type VersionedLoadableState<Version, Value = any, Error = any> = {
  of<V extends Version | Nill>(
    version: V
  ): NillChecker<V, LoadableAsyncState<Value, Error>>;
};

export type VersionedPausableAsyncState<Version, Value = any, Error = any> = {
  of<V extends Version | Nill>(
    version: V
  ): NillChecker<V, PausableLoadableAsyncState<Value, Error>>;
};

export type VersionedNestedState<Version, Value = any> = BasePath & {
  of<V extends Version | Nill>(version: V): NillChecker<V, NestedState<Value>>;
  path<P extends Path<Value>>(
    ...path: P
  ): VersionedNestedState<Version, Get<Value, P>>;
};

export type VersionedNestedAsyncState<
  Version,
  Value = any,
  Error = any,
> = BasePath & {
  of<V extends Version | Nill>(
    version: V
  ): NillChecker<V, AsyncNestedState<Value, Error>>;
  path<P extends Path<Value>>(
    ...path: P
  ): VersionedNestedAsyncState<Version, Get<Value, P>, Error>;
};

export type VersionedNestedLoadableState<
  Version,
  Value = any,
  Error = any,
> = BasePath & {
  of<V extends Version | Nill>(
    version: V
  ): NillChecker<V, LoadableAsyncNestedState<Value, Error>>;
  path<P extends Path<Value>>(
    ...path: P
  ): VersionedNestedLoadableState<Version, Get<Value, P>, Error>;
};

export type VersionedNestedPollableState<
  Version,
  Value = any,
  Error = any,
> = BasePath & {
  of<V extends Version | Nill>(
    version: V
  ): NillChecker<V, PausableLoadableAsyncNestedState<Value, Error>>;
  path<P extends Path<Value>>(
    ...path: P
  ): VersionedNestedPollableState<Version, Get<Value, P>, Error>;
};

export type ValuesOf<T> = T extends [infer Head, ...infer Tail]
  ? [Head extends AnyAsyncState<infer K> ? K : undefined, ...ValuesOf<Tail>]
  : [];

export type AsyncStateOptions<T> = {
  value?: T;
  isLoaded?(value: T, prevValue: T): boolean;
};

export type LoadableAsyncStateOptions<T> = AsyncStateOptions<T> & {
  load(state: AnyLoadableAsyncState): void | (() => void);
  loadingTimeout?: number;
};

export type PausableLoadableAsyncStateOptions<T> =
  LoadableAsyncStateOptions<T> & {
    pause(): void;
    resume(): void;
  };

export type RequestableStateOptions<T, E = any> = Pick<
  LoadableAsyncStateOptions<T>,
  'value' | 'loadingTimeout'
> & {
  fetcher(): Promise<T>;
  shouldRetryOnError?(err: E, attempt: number): number;
};

export type PollableStateOptions<T, E = any> = RequestableStateOptions<T, E> &
  Pick<AsyncStateOptions<T>, 'isLoaded'> & {
    interval: number;
    hiddenInterval?: number;
  };
