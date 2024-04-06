/** @internal */
export type Key = number | string;

type Get<O, Path> = Path extends [infer Key, ...infer Rest]
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

type Path<O> = O extends any[] | Record<any, any>
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
  HANDLE_LISTENERS,
  LOAD,
  IS_LOAD_AVAILABLE,
  POLLING_PAUSE,
  POLLING_RESUME,
}

/** @internal */
export type SetKey =
  | RootKey.ERROR_CALLBACK_SET
  | RootKey.IS_LOADED_CALLBACK_SET;

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
        : K extends RootKey.HANDLE_LISTENERS
          ? Listener | undefined
          : K extends RootKey.IS_LOAD_AVAILABLE
            ? boolean | undefined
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

type HandleListeners = (state: AnyAsyncState) => () => void;

export type AsyncRoot<Value = any, Error = any> = Root<Value> &
  Map<RootKey.LOAD, Listener> &
  Map<RootKey.ERROR, Error> &
  Map<RootKey.ERROR_CALLBACK_SET, CallbackSet> &
  Map<RootKey.IS_LOADED, boolean> &
  Map<RootKey.IS_LOADED_CALLBACK_SET, CallbackSet> &
  Map<RootKey.PROMISE, Promise<Value>> &
  Map<RootKey.HANDLE_LISTENERS, HandleListeners>;

export type LoadableRoot<Value = any, Error = any> = AsyncRoot<Value, Error> &
  Map<RootKey.IS_LOAD_AVAILABLE, boolean>;

export type PollableRoot<Value = any, Error = any> = LoadableRoot<
  Value,
  Error
> &
  Map<RootKey.POLLING_PAUSE, () => void> &
  Map<RootKey.POLLING_RESUME, () => void>;

type BaseState<R> = {
  /** root */
  readonly r: R;
  readonly v?: any;
};

type InnerState<R> = BaseState<R> & Partial<BasePath>;

export type AnyState<Value = any> = InnerState<
  Root<Value> | AsyncRoot<Value> | LoadableRoot<Value> | PollableRoot<Value>
>;

export type AnyAsyncState<Value = any, Error = any> = InnerState<
  | AsyncRoot<Value, Error>
  | LoadableRoot<Value, Error>
  | PollableRoot<Value, Error>
>;

export type AnyLoadableState<Value = any, Error = any> = InnerState<
  LoadableRoot<Value, Error> | PollableRoot<Value, Error>
>;

export type AnyPollableState<Value = any, Error = any> = InnerState<
  PollableRoot<Value, Error>
>;

type BasePath = {
  /** path */
  readonly p: Key[];
};

export type State<Value = any> = BaseState<Root<Value>>;

export type AsyncState<Value = any, Error = any> = BaseState<
  AsyncRoot<Value, Error>
>;

export type LoadableState<Value = any, Error = any> = BaseState<
  LoadableRoot<Value, Error>
>;

export type PollableState<Value = any, Error = any> = BaseState<
  PollableRoot<Value, Error>
>;

export type NestedState<Value = any> = BasePath &
  BaseState<Root<Value>> & {
    path<P extends Path<Value>>(...path: P): NestedState<Get<Value, P>>;
  };

export type NestedAsyncState<Value = any, Error = any> = BasePath &
  BaseState<AsyncRoot<Value, Error>> & {
    path<P extends Path<Value>>(
      ...path: P
    ): NestedAsyncState<Get<Value, P>, Error>;
  };

export type NestedLoadableState<Value = any, Error = any> = BasePath &
  BaseState<LoadableRoot<Value, Error>> & {
    path<P extends Path<Value>>(
      ...path: P
    ): NestedLoadableState<Get<Value, P>, Error>;
  };

export type NestedPollableState<Value = any, Error = any> = BasePath &
  BaseState<PollableRoot<Value, Error>> & {
    path<P extends Path<Value>>(
      ...path: P
    ): NestedPollableState<Get<Value, P>, Error>;
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
  ): NillChecker<V, LoadableState<Value, Error>>;
};

export type VersionedPollableState<Version, Value = any, Error = any> = {
  of<V extends Version | Nill>(
    version: V
  ): NillChecker<V, PollableState<Value, Error>>;
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
  ): NillChecker<V, NestedAsyncState<Value, Error>>;
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
  ): NillChecker<V, NestedLoadableState<Value, Error>>;
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
  ): NillChecker<V, NestedPollableState<Value, Error>>;
  path<P extends Path<Value>>(
    ...path: P
  ): VersionedNestedPollableState<Version, Get<Value, P>, Error>;
};

export type Options<V, T> = {
  fetcher(version: V, ...args: any[]): Promise<T>;
  reloadOnFocus?: number;
  reloadOnReconnect?: boolean;
  pollingWhenHidden?: number | ((prevValue: T) => number);
  pollingInterval: number | ((prevValue: T) => number);
  isDone(prevValue: T): boolean;
  dedupingInterval?: number;
  loadingTimeout?: number;
};
