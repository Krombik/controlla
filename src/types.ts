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

// @ts-expect-error
declare const __nastyHack = <T, E>() =>
  class SuperState {
    static get(): T;
    static set(value: T): void;
    static delete(): void;
    static use(disabled?: boolean): T;
    static getPromise(): Promise<T>;
    static setError(error: E): void;
    static getError(): E;
    static useError(): E;
    static onChange(cb: (value: T) => void): void;
    static onError(cb: (error: E) => void): void;
    static suspense(disabled?: boolean): T;
  };

// @ts-expect-error
declare const __versionedNastyHack = <V, T, E>() =>
  class SuperVersionedState {
    static get(version: V): T;
    static set(version: V, value: T): void;
    static delete(version: V): void;
    static use(version: V, disabled?: boolean): T;
    static getPromise(version: V): Promise<T>;
    static setError(version: V, error: E): void;
    static getError(version: V): E;
    static useError(version: V): E;
    static onChange(version: V, cb: (value: T) => void): ()=>void;
    static onError(version: V, cb: (error: E) => void): ()=>void;
    static suspense(version: V, disabled?: boolean): T;
  };

export interface SuperVersionedState<V, T, E = any>
  extends ReturnType<typeof __versionedNastyHack<V, T, E>> {
  <P extends Path<T>>(
    ...path: P
  ): Pick<
    ReturnType<typeof __versionedNastyHack<V, Get<T, P>, E>>,
    'get' | 'set' | 'onChange' | 'suspense' | 'use'
  >;
}

export interface SuperState<T, E = any>
  extends ReturnType<typeof __nastyHack<T, E>> {
  <P extends Path<T>>(
    ...path: P
  ): Pick<
    ReturnType<typeof __nastyHack<Get<T, P>, E>>,
    'get' | 'set' | 'onChange' | 'suspense' | 'use'
  >;
}
