import toKey, { type PrimitiveOrNested } from 'keyweaver';
import type {
  AnyState,
  NestedStorageKeys,
  AsyncNestedState,
  AsyncState,
  LoadableNestedState,
  LoadableState,
  NestedState,
  NestedStateStorage,
  ControllableNestedState,
  ControllableState,
  State,
  StateStorage,
} from '../types';
import { EMPTY_ARR } from '../utils/constants';
import path from '../utils/path';

function get(this: StateStorage<any, any, any[]>, ...args: any[]) {
  let item = this._get(args, 0) as StateStorage<any, any> | Record<string, any>;

  for (let i = 1; i < args.length; i++) {
    item = (item as StateStorage<any, any>)._get(args, i);
  }

  if (this.a.length) {
    args = this.a.concat(args);
  }

  return '_r' in item || '_get' in item
    ? {
        ...item,
        a: args,
      }
    : Object.keys(item).reduce<Record<string, any>>(
        (acc, key) => ({
          ...acc,
          [key]: {
            ...item[key],
            a: args,
          },
        }),
        {}
      );
}

const recursiveWrap = (
  getItem: (args?: any[]) => any,
  count: number
): (() => NestedStateStorage<any[], any>) =>
  count
    ? recursiveWrap((): StateStorage<any, any, any[]> => {
        type Item = AnyState | StateStorage<any, any>;

        const storage = new Map<any, Item>();

        let keyStorage: Map<string, any>;

        return {
          get: get as any,
          path,
          a: EMPTY_ARR,
          _p: EMPTY_ARR,
          _get(args, index) {
            const arg = args[index];

            if (storage.has(arg)) {
              return storage.get(arg)!;
            }

            if (arg && typeof arg == 'object') {
              keyStorage ||= new Map();

              const key = toKey(arg);

              if (keyStorage.has(key)) {
                const prevArg = keyStorage.get(key)!;

                const item = storage.get(prevArg)!;

                storage.delete(prevArg);

                storage.set(arg, item);

                keyStorage.set(key, arg);

                return item;
              }

              keyStorage.set(key, arg);
            }

            const item: Item = getItem(args);

            storage.set(arg, item);

            return item;
          },
        };
      }, count - 1)
    : getItem;

type GenerateArr<
  Length extends number,
  Result extends PrimitiveOrNested[] = [],
> = Result['length'] extends Length
  ? Result
  : GenerateArr<Length, [...Result, PrimitiveOrNested]>;

type AnyAsyncOptions = { value?(...args: any): any };

type AnyOptions = { load(...args: any[]): any } & AnyAsyncOptions;

type DefaultCount<Keys> = Keys extends any[]
  ? Keys['length'] extends 0
    ? 1
    : Keys['length']
  : 1;

type CommonStateArgs<State, C extends number, T> = [
  createState: (value: Exclude<T, () => any>) => State,
  defaultValue?: T,
  ...args: C extends 1 ? [deepness?: C] : [deepness: C],
];

type CommonGetStateArgs<State, Keys extends any[], T> = [
  createState: (getValue: () => T) => State,
  getDefaultValue: (...args: Keys) => T,
];

type AsyncGetStateArgs<
  State,
  Keys extends any[],
  O extends AnyAsyncOptions,
  T,
> = [
  createState: (options: O) => State,
  options: Omit<O, 'value'> & {
    value(...args: Keys): T;
  },
];

type AsyncStateArgs<State, C extends number, T> = [
  createState: (options?: { value?: T }) => State,
  options?: {
    value?: T;
  },
  ...args: C extends 1 ? [deepness?: C] : [deepness: C],
];

type LoadableStateArgs<State, Keys extends any[], O extends AnyOptions, T> = [
  createState: (options: O) => State,
  options: Omit<O, 'load' | 'value'> & {
    load(...args: Keys): ReturnType<O['load']>;
    value?: T | ((...args: Keys) => T);
  },
];

const createStateStorage: {
  <
    T extends Record<string, NestedStateStorage<PrimitiveOrNested[], any>>,
    Keys extends GenerateArr<C>,
    C extends number = DefaultCount<Keys>,
  >(
    getState: () => T,
    ...args: C extends 1 ? [deepness?: C] : [deepness: C]
  ): NestedStateStorage<
    Keys,
    { [key in keyof T]: T[key] & NestedStorageKeys<Keys> }
  >;

  <T, E, O extends AnyAsyncOptions, Keys extends PrimitiveOrNested[]>(
    ...args: AsyncGetStateArgs<AsyncNestedState<T, E>, Keys, O, T>
  ): NestedStateStorage<Keys, AsyncNestedState<T, E, Keys>>;
  <T, E, O extends AnyAsyncOptions, Keys extends PrimitiveOrNested[]>(
    ...args: AsyncGetStateArgs<AsyncState<T, E>, Keys, O, T>
  ): NestedStateStorage<Keys, AsyncState<T, E, Keys>>;

  <
    T,
    Keys extends GenerateArr<C>,
    E = any,
    C extends number = DefaultCount<Keys>,
  >(
    ...args: AsyncStateArgs<AsyncNestedState<T, E>, C, T>
  ): NestedStateStorage<Keys, AsyncNestedState<T, E, Keys>>;
  <
    T,
    Keys extends GenerateArr<C>,
    E = any,
    C extends number = DefaultCount<Keys>,
  >(
    ...args: AsyncStateArgs<AsyncState<T, E>, C, T>
  ): NestedStateStorage<Keys, AsyncState<T, E, Keys>>;

  <T, E, O extends AnyOptions, Keys extends PrimitiveOrNested[]>(
    ...args: LoadableStateArgs<LoadableNestedState<T, E>, Keys, O, T>
  ): NestedStateStorage<Keys, LoadableNestedState<T, E, Keys>>;
  <T, E, O extends AnyOptions, Keys extends PrimitiveOrNested[]>(
    ...args: LoadableStateArgs<LoadableState<T, E>, Keys, O, T>
  ): NestedStateStorage<Keys, LoadableState<T, E, Keys>>;

  <T, E, O extends AnyOptions, Keys extends PrimitiveOrNested[]>(
    ...args: LoadableStateArgs<ControllableNestedState<T, E>, Keys, O, T>
  ): NestedStateStorage<Keys, ControllableNestedState<T, E, Keys>>;
  <T, E, O extends AnyOptions, Keys extends PrimitiveOrNested[]>(
    ...args: LoadableStateArgs<ControllableState<T, E>, Keys, O, T>
  ): NestedStateStorage<Keys, ControllableState<T, E, Keys>>;

  <T, Keys extends PrimitiveOrNested[]>(
    ...args: CommonGetStateArgs<NestedState<T>, Keys, T>
  ): NestedStateStorage<Keys, NestedState<T, Keys>>;
  <T, Keys extends PrimitiveOrNested[]>(
    ...args: CommonGetStateArgs<State<T>, Keys, T>
  ): NestedStateStorage<Keys, State<T, Keys>>;

  <T, Keys extends GenerateArr<C>, C extends number = DefaultCount<Keys>>(
    ...args: CommonStateArgs<NestedState<T>, C, T>
  ): NestedStateStorage<Keys, NestedState<T, Keys>>;
  <T, Keys extends GenerateArr<C>, C extends number = DefaultCount<Keys>>(
    ...args: CommonStateArgs<State<T>, C, T>
  ): NestedStateStorage<Keys, State<T, Keys>>;
} = (
  createState: (arg?: any, args?: any[]) => AnyState,
  arg2?: AnyOptions | ((...args: any[]) => any) | number | unknown,
  arg3?: number
) => {
  let fn: undefined | ((...args: any[]) => any);

  let count: number | undefined;

  const l = createState.length;

  const typeofArg2 = typeof arg2;

  if (!l) {
    fn = createState;

    if (typeofArg2 == 'number') {
      count = arg2 as number;
    }
  } else if (typeofArg2 == 'function') {
    count = (arg2 as Function).length;

    if (l == 1) {
      fn = (args) => createState((arg2 as Function)(...args));
    }
  } else if (arg2 && typeofArg2 == 'object') {
    const { load, value } = arg2 as Partial<AnyOptions>;

    if (load) {
      count = load.length;
    }

    if (typeof value == 'function') {
      count ||= value.length;

      if (l == 1) {
        fn = (args) => createState({ ...arg2, value: value(...args) });
      }
    }
  }

  return recursiveWrap(
    fn || createState.bind(null, arg2),
    count || arg3 || 1
  )();
};

export default createStateStorage;
