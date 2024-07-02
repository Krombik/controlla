import toKey, { type PrimitiveOrNested } from 'keyweaver';
import type {
  AnyState,
  AsyncNestedState,
  AsyncState,
  LoadableAsyncNestedState,
  LoadableAsyncState,
  NestedState,
  NestedStateStorage,
  PausableLoadableAsyncNestedState,
  PausableLoadableAsyncState,
  State,
  StateStorage,
} from '../types';
import { EMPTY_ARR } from '../utils/constants';
import path from '../utils/path';

const recursiveWrap = (
  getItem: (args?: any[]) => any,
  count: number
): (() => NestedStateStorage<any[], any>) =>
  count
    ? recursiveWrap((): StateStorage<any, any, any[]> => {
        type Item = AnyState | StateStorage<any, any>;

        const storage: Map<any, Item> = new Map();

        return {
          _p: EMPTY_ARR,
          a: EMPTY_ARR,
          _get(args, index) {
            const arg = args[index];

            const key = arg && typeof arg == 'object' ? toKey(arg) : arg;

            if (storage.has(key)) {
              return storage.get(key)!;
            }

            const item: Item = getItem(args);

            storage.set(key, item);

            return item;
          },
          get(...args: any[]): any {
            let item: Item = this._get(args, 0);

            for (let i = 1; i < args.length; i++) {
              item = (item as StateStorage<any, any>)._get(args, i);
            }

            return {
              ...item,
              ...(item._p && this._p.length
                ? { p: item._p.length ? item._p.concat(this._p) : this._p }
                : {}),
              a: this.a.length ? this.a.concat(args) : args,
            };
          },
          path,
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

type DefaultCount<Keys> = Keys extends any[] ? Keys['length'] : 1;

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
    ...args: LoadableStateArgs<LoadableAsyncNestedState<T, E>, Keys, O, T>
  ): NestedStateStorage<Keys, LoadableAsyncNestedState<T, E, Keys>>;
  <T, E, O extends AnyOptions, Keys extends PrimitiveOrNested[]>(
    ...args: LoadableStateArgs<LoadableAsyncState<T, E>, Keys, O, T>
  ): NestedStateStorage<Keys, LoadableAsyncState<T, E, Keys>>;

  <T, E, O extends AnyOptions, Keys extends PrimitiveOrNested[]>(
    ...args: LoadableStateArgs<
      PausableLoadableAsyncNestedState<T, E>,
      Keys,
      O,
      T
    >
  ): NestedStateStorage<Keys, PausableLoadableAsyncNestedState<T, E, Keys>>;
  <T, E, O extends AnyOptions, Keys extends PrimitiveOrNested[]>(
    ...args: LoadableStateArgs<PausableLoadableAsyncState<T, E>, Keys, O, T>
  ): NestedStateStorage<Keys, PausableLoadableAsyncState<T, E, Keys>>;

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
  arg2?: AnyOptions | ((...args: any[]) => any) | unknown,
  arg3?: number
) => {
  const isCommonState = createState.length == 1;

  let fn: undefined | ((...args: any[]) => any);

  let count: number | undefined = arg3;

  switch (typeof arg2) {
    case 'object': {
      if (arg2) {
        const { load, value } = arg2 as Partial<AnyOptions>;

        if (load) {
          count = load.length;
        }

        if (typeof value == 'function') {
          count ||= value.length;

          if (isCommonState) {
            fn = (args) => createState({ ...arg2, value: value(...args) });
          }
        }
      }

      break;
    }

    case 'function': {
      count = arg2.length;

      if (isCommonState) {
        fn = (args) => createState(arg2(...args));
      }
    }
  }

  return recursiveWrap(fn || createState.bind(null, arg2), count || 1)();
};

export default createStateStorage;
