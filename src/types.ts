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
declare const __getSuperState = <T, E>() =>
  class SuperState {
    static get(): T;
    static set(value: T): void;
    static delete(): void;
    static use(disabled?: false): T;
    static use(disabled: true): undefined;
    static getPromise(): Promise<T>;
    static setError(error: E): void;
    static getError(): E | undefined;
    static useError(): E | undefined;
    static onChange(cb: (value: T) => void): () => void;
    static onError(cb: (error: E) => void): () => void;
    static suspense(disabled?: false): T;
    static suspense(disabled: true): undefined;
  };

type Nill = null | undefined;

// @ts-expect-error
declare const __getVersionedSuperState = <V, T, E>() =>
  class SuperVersionedState {
    static get(version: V): T;
    static get(version: Nill): undefined;
    static set(version: V | Nill, value: T): void;
    static delete(version: V | Nill): void;
    static use(version: V, disabled?: false): T;
    static use(version: V, disabled: true): undefined;
    static use(version: Nill, disabled?: boolean): undefined;
    static getPromise(version: V): Promise<T>;
    static getPromise(version: Nill): undefined;
    static setError(version: V | Nill, error: E): void;
    static getError(version: V): E | undefined;
    static getError(version: Nill): undefined;
    static useError(version: V): E | undefined;
    static useError(version: Nill): undefined;
    static onChange(version: V, cb: (value: T) => void): () => void;
    static onChange(version: Nill, cb: (value: T) => void): void;
    static onError(version: V, cb: (error: E) => void): () => void;
    static onError(version: Nill, cb: (error: E) => void): void;
    static suspense(version: V, disabled?: false): T;
    static suspense(version: V, disabled: true): undefined;
    static suspense(version: Nill, disabled?: boolean): undefined;
  };

export type NestedMethods = Extract<
  keyof ReturnType<typeof __getSuperState>,
  'get' | 'set' | 'onChange' | 'suspense' | 'use'
>;

export type RootMethods = Exclude<
  keyof ReturnType<typeof __getSuperState>,
  NestedMethods | 'prototype'
>;

export interface VersionedSuperState<V, T, E = any>
  extends ReturnType<typeof __getVersionedSuperState<V, T, E>> {
  <P extends Path<T>>(
    ...path: P
  ): Pick<
    ReturnType<typeof __getVersionedSuperState<V, Get<T, P>, E>>,
    NestedMethods
  >;
}

export interface SuperState<T, E = any>
  extends ReturnType<typeof __getSuperState<T, E>> {
  <P extends Path<T>>(
    ...path: P
  ): Pick<ReturnType<typeof __getSuperState<Get<T, P>, E>>, NestedMethods>;
}
