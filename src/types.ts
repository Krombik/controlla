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

export type _SuperState<T = any, E = any> = {
  get(): T;
  set(value: T | ((prevValue: T) => T)): void;
  clear(): void;
  use<D extends boolean = false>(disabled?: D): D extends true ? undefined : T;
  getPromise(): Promise<Exclude<T, undefined>>;
  setError(error: E): void;
  getError(): E | undefined;
  useError(disabled?: boolean): E | undefined;
  onChange(cb: (value: T) => void): () => void;
  onError(cb: (error: E) => void): () => void;
  suspense<D extends boolean = false>(
    disabled?: D
  ): D extends true ? undefined : T;
};

export type NestedMethods = Extract<
  keyof _SuperState,
  'get' | 'set' | 'onChange' | 'suspense' | 'use'
>;

export type NoopRecord<T extends Record<string, (...args: any[]) => any>> = {
  [Key in keyof T]: (...args: Parameters<T[Key]>) => undefined;
};

type NoopDecider<V, T extends {}> = [Extract<V, Nill>] extends [never]
  ? T
  : [Exclude<V, Nill>] extends [never]
    ? NoopRecord<T>
    : T | NoopRecord<T>;

export type VersionedSuperState<Version, Value, Error = any> = {
  <V extends Version | Nill>(
    version: V
  ): NoopDecider<V, _SuperState<Value, Error>>;
  <V extends Version | Nill, P extends Path<Value>>(
    version: V,
    ...path: P
  ): NoopDecider<V, Pick<_SuperState<Get<Value, P>, Error>, NestedMethods>>;
};

export type SuperState<Value, Error = any> = {
  (): _SuperState<Value, Error>;
  <P extends Path<Value>>(
    ...path: P
  ): Pick<_SuperState<Get<Value, P>, Error>, NestedMethods>;
};

type Options<T> = {
  fetcher(): Promise<T>;
  refetchOnFocus?: number;
  refetchOnReconnect?: boolean;
  fetchWhenHidden?: boolean;
  pollingInterval?: number | ((prevValue: T, attempt: number) => number);
  dedupingInterval?: boolean;
  loadingTimeout?: number;
  onLoadingSlow?(): void;
  isPaused?(): boolean;
};

export type CreateSuperState = {
  <Value = any, Error = any>(): SuperState<Value | undefined, Error>;
  <Value, Error = any>(initialValue: Value): SuperState<Value, Error>;
  <Value, Error = any>(
    fetcher: () => Promise<Value>,
    dedupingInterval?: number
  ): SuperState<Value | undefined, Error>;
  <Value, Error = any>(
    fetcher: () => Promise<Value>,
    dedupingInterval: number,
    initialValue: Value
  ): SuperState<Value, Error>;
};
