type SetArgs = [...GetArgs, value: unknown];

type GetArgs<P extends Key[]> = [version: Key, ...path: P];

type HookArgs = [...GetArgs, disabled: boolean];

type Get<O, Path> = Path extends [infer Key, ...infer Rest]
  ? Key extends keyof NonNullable<O>
    ? Get<
        | NonNullable<O>[Key]
        | ([Extract<O, null | undefined>] extends [never] ? never : undefined),
        Rest
      >
    : never
  : O;

type Key = number | string;

type ToNumber<T> = T extends `${infer K extends number}` ? K : never;

type Indexes<T extends any[]> = T extends [infer _, ...any[]]
  ? ToNumber<Exclude<keyof T, keyof []>>
  : number;

type NestedPath<O, K extends keyof O> = [] extends O
  ? []
  : {
      [key in K]: Partial<[key, ...Path<O[key]>]>;
    }[K];

type Path<O> = O extends any[] | Record<any, any>
  ? NestedPath<Required<O>, O extends any[] ? Indexes<O> : keyof O>
  : [];

export type kek<T> = {
  get<P extends Path<T>>(...path: P): Get<T, P>;
  set(...args: SetArgs): void;
  delete(version: Key): void;
  use(...args: GetArgs | HookArgs): unknown;
  getPromise(version: Key): Promise<unknown>;
  setError(version: Key, error: unknown): void;
  getError(version: Key): unknown;
  useError(version: Key): unknown;
  onChange(...args: [...GetArgs, cb: (value: unknown) => void]): void;
  onError(version: Key, cb: (error: unknown) => void): void;
  suspense(...args: GetArgs | HookArgs): any;
};
