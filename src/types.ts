import { AsyncState, BaseState, ErrorState } from '.';

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

export type _SuperState<T = any> = {
  get(): T;
  set(value: T | ((prevValue: T) => T)): void;
  use<D extends boolean = false>(disabled?: D): D extends true ? undefined : T;
  onChange(cb: (value: T) => void): () => void;
  suspense<D extends boolean = false>(
    disabled?: D
  ): D extends true ? undefined : T;
};

export type NestedMethods = Extract<
  keyof _SuperState,
  'get' | 'set' | 'onChange' | 'suspense' | 'use'
>;

export type NoopRecord<T extends Record<string, (...args: any[]) => any>> = {
  [Key in Extract<keyof T, 'use' | 'suspense'>]: (
    ...args: Parameters<T[Key]>
  ) => undefined;
};

type NoopDecider<V, T extends {}> = [Extract<V, Nill>] extends [never]
  ? T
  : [Exclude<V, Nill>] extends [never]
    ? NoopRecord<T>
    : T | NoopRecord<T>;

export interface VersionedSuperState<Version, Value, Error = any> {
  <V extends Version | Nill>(version: V): NoopDecider<V, AsyncState<Value>>;
  <V extends Version | Nill, P extends Path<Value>>(
    version: V,
    ...path: P
  ): NoopDecider<V, AsyncState<Get<Value, P>>>;
  clear(version: NonNullable<Version>): void;
  error<V extends Version | Nill>(
    version: V
  ): NoopDecider<V, ErrorState<Error>>;
  getPromise(version: NonNullable<Version>): Promise<Exclude<Value, undefined>>;
  fetch(version: NonNullable<Version>): this;
  refetch(version: NonNullable<Version>): this;
  onLoadingSlow(cb: (version: NonNullable<Version>) => void): () => void;
  isLoaded<V extends Version | Nill>(
    version: V
  ): NoopDecider<V, BaseState<boolean>>;
}

export type SuperState<Value, Error = any> = {
  <P extends Path<Value>>(...path: P): AsyncState<Get<Value, P>>;
  clear(): void;
  getPromise(): Promise<Exclude<Value, undefined>>;
  error: ErrorState<Error>;
};

export type Options<V, T> = {
  fetcher(version: V, ...args: any[]): Promise<T>;
  reloadOnFocus?: number;
  reloadOnReconnect?: boolean;
  pollingWhenHidden?: number | ((prevValue: T) => number);
  pollingInterval: number | ((prevValue: T) => number);
  dedupingInterval?: number;
  loadingTimeout?: number;
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
