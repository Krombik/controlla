export type Key = number | string;

type Get<K, Path, O = Exclude<K, typeof NOT_LOADED>> = Path extends [
  infer Key,
  ...infer Rest,
]
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

type Path<K, O = Exclude<K, typeof NOT_LOADED>> = O extends
  | any[]
  | Record<any, any>
  ? NestedPath<Required<O>, O extends any[] ? Indexes<O> : keyof O>
  : [];

type Nill = null | undefined;

export type Falsy = Nill | false | 0 | '';

export type CallbackSet = Set<(value: any) => void>;

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

export type SetKey =
  | RootKey.ERROR_CALLBACK_SET
  | RootKey.IS_LOADED_CALLBACK_SET
  | RootKey.SLOW_LOADING_CALLBACK_SET;

export type ValueKey = RootKey.VALUE | RootKey.ERROR | RootKey.IS_LOADED;

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
  (rootValue: any, path: Key[]) => Exclude<Value, typeof NOT_LOADED>
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

export type AsyncRoot<Value = any, Error = any> = Root<
  Value | typeof NOT_LOADED
> &
  Map<RootKey.ERROR, Error> &
  Map<RootKey.ERROR_CALLBACK_SET, CallbackSet> &
  Map<RootKey.IS_LOADED, boolean> &
  Map<RootKey.IS_LOADED_CALLBACK_SET, CallbackSet> &
  Map<RootKey.PROMISE, Promise<Value>>;

export type LoadableRoot<Value = any, Error = any> = AsyncRoot<Value, Error> &
  Map<
    RootKey.LOAD,
    (
      state: InnerState<LoadableRoot<Value, Error>> & Partial<Arguments<any[]>>,
      force?: boolean
    ) => () => void
  > &
  Map<RootKey.SLOW_LOADING_CALLBACK_SET, Set<() => void>>;

export type PausableRoot<Value = any, Error = any> = LoadableRoot<
  Value,
  Error
> &
  Map<RootKey.PAUSE, () => void> &
  Map<RootKey.RESUME, () => void>;

type Arguments<Keys extends any[]> = {
  readonly a: Keys;
};

type BaseState<R, K extends any[] = []> = {
  /** root */
  readonly r: R;
} & (K['length'] extends 0 ? {} : Arguments<K>);

type InnerState<R> = BaseState<R> & Partial<BasePath>;

export type AnyState<Value = any> = InnerState<
  Root<Value> | AsyncRoot<Value> | LoadableRoot<Value> | PausableRoot<Value>
>;

type AnyNestedState<T = any> = AnyState<T> & BasePath;

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

export type State<Value = any, Keys extends any[] = []> = BaseState<
  Root<Value>,
  Keys
>;

export type AsyncState<
  Value = any,
  Error = any,
  Keys extends any[] = [],
> = BaseState<AsyncRoot<Value | typeof NOT_LOADED, Error>, Keys>;

export type LoadableAsyncState<
  Value = any,
  Error = any,
  Keys extends any[] = [],
> = BaseState<LoadableRoot<Value | typeof NOT_LOADED, Error>, Keys>;

export type PausableLoadableAsyncState<
  Value = any,
  Error = any,
  Keys extends any[] = [],
> = BaseState<PausableRoot<Value | typeof NOT_LOADED, Error>, Keys>;

export type NestedState<Value = any, Keys extends any[] = []> = BasePath &
  BaseState<Root<Value>, Keys> & {
    path<P extends Path<Value>>(...path: P): NestedState<Get<Value, P>, Keys>;
  };

export declare const NOT_LOADED: unique symbol;

export type AsyncNestedState<
  Value = any,
  Error = any,
  Keys extends any[] = [],
> = BasePath &
  BaseState<AsyncRoot<Value | typeof NOT_LOADED, Error>, Keys> & {
    path<P extends Path<Value>>(
      ...path: P
    ): AsyncNestedState<Get<Value, P>, Error, Keys>;
  };

export type LoadableAsyncNestedState<
  Value = any,
  Error = any,
  Keys extends any[] = [],
> = BasePath &
  BaseState<LoadableRoot<Value | typeof NOT_LOADED, Error>, Keys> & {
    path<P extends Path<Value>>(
      ...path: P
    ): LoadableAsyncNestedState<Get<Value, P>, Error, Keys>;
  };

export type PausableLoadableAsyncNestedState<
  Value = any,
  Error = any,
  Keys extends any[] = [],
> = BasePath &
  BaseState<PausableRoot<Value | typeof NOT_LOADED, Error>, Keys> & {
    path<P extends Path<Value>>(
      ...path: P
    ): PausableLoadableAsyncNestedState<Get<Value, P>, Error, Keys>;
  };

export type ValuesOf<T> = T extends [infer Head, ...infer Tail]
  ? [
      Head extends AnyAsyncState<infer K>
        ? Exclude<K, typeof NOT_LOADED>
        : undefined,
      ...ValuesOf<Tail>,
    ]
  : [];

export type AsyncStateOptions<T> = {
  value?: T;
  isLoaded?(value: T, prevValue: T): boolean;
};

export type LoadableAsyncStateOptions<
  T,
  E = any,
  Keys extends any[] = [],
> = AsyncStateOptions<T> & {
  load(this: AnyLoadableAsyncState<T, E>, ...keys: Keys): void | (() => void);
  loadingTimeout?: number;
};

export type PausableLoadableAsyncStateOptions<
  T,
  E = any,
  Keys extends any[] = [],
> = LoadableAsyncStateOptions<T, E, Keys> & {
  pause(): void;
  resume(): void;
};

export type RequestableStateOptions<T, E = any, Keys extends any[] = []> = Pick<
  LoadableAsyncStateOptions<T>,
  'value' | 'loadingTimeout'
> & {
  load(...args: Keys): Promise<T>;
  shouldRetryOnError?(err: E, attempt: number): number;
};

export type PollableStateOptions<
  T,
  E = any,
  Keys extends any[] = [],
> = RequestableStateOptions<T, E, Keys> &
  Pick<AsyncStateOptions<T>, 'isLoaded'> & {
    interval: number;
    hiddenInterval?: number;
  };

type KeysOfStorage<T, Acc extends any[] = []> =
  T extends StateStorage<infer Key, infer Item>
    ? KeysOfStorage<Item, [...Acc, Key]>
    : Acc;

type GetChild<T, Keys extends any[]> = Keys extends [infer Head, ...infer Tail]
  ? T extends StateStorage<Head, infer Item>
    ? GetChild<Item, Tail>
    : T
  : T;

type GetNestedStateValue<T> = T extends AnyNestedState<infer V> ? V : never;

type GetState<T> =
  T extends StateStorage<any, infer Child> ? GetState<Child> : T;

export type NestedStateStorage<Keys extends any[], V> = Keys extends [
  ...infer Head,
  infer Tail,
]
  ? NestedStateStorage<Head, StateStorage<Tail, V, Head>>
  : V;

export type StateStorage<K, T, Keys extends any[] = any[]> = BasePath &
  Arguments<Keys> & {
    get<Keys extends Partial<KeysOfStorage<T>>>(
      key: K,
      ...keys: Keys
    ): GetChild<T, Keys>;
    path<P extends Path<GetNestedStateValue<GetState<T>>>>(
      ...path: P
    ): StateStorage<
      K,
      NestedStateStorage<
        KeysOfStorage<T>,
        GetState<T> extends NestedState<infer V>
          ? NestedState<Get<V, P>>
          : GetState<T> extends AsyncNestedState<infer V, infer E>
            ? AsyncNestedState<Get<V, P>, E>
            : GetState<T> extends LoadableAsyncNestedState<infer V, infer E>
              ? LoadableAsyncNestedState<Get<V, P>, E>
              : GetState<T> extends PausableLoadableAsyncNestedState<
                    infer V,
                    infer E
                  >
                ? PausableLoadableAsyncNestedState<Get<V, P>, E>
                : never
      >,
      Keys
    >;
  };
