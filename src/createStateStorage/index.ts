import toKey from 'keyweaver';
import {
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
  getItem: () => any,
  count: number
): (() => NestedStateStorage<any[], any>) =>
  count
    ? recursiveWrap((): StateStorage<any, any> => {
        type Item = AnyState | StateStorage<any, any>;

        const storage: Map<any, Item> = new Map();

        let versionStorage: Map<string, any>;

        return {
          p: EMPTY_ARR,
          a: EMPTY_ARR,
          get(...args: any[]): any {
            const arg = args[0];

            let item: Item;

            if (storage.has(arg)) {
              item = storage.get(arg)!;
            } else {
              if (typeof arg == 'object') {
                versionStorage ||= new Map();

                const stringifiedVersion = toKey(arg);

                if (versionStorage.has(stringifiedVersion)) {
                  const prevVersion = versionStorage.get(stringifiedVersion)!;

                  if (storage.has(prevVersion)) {
                    const root = storage.get(prevVersion)!;

                    storage.delete(prevVersion);

                    storage.set(arg, root);

                    return root;
                  }
                } else {
                  versionStorage.set(stringifiedVersion, arg);
                }
              }

              item = {
                ...getItem(),
                a: this.a.length ? this.a.concat(arg) : [arg],
              };

              storage.set(arg, item);
            }

            for (let i = 1; i < args.length; i++) {
              item = (item as StateStorage<any, any>).get(args[i]);
            }

            return 'p' in item && this.p.length
              ? { ...item, p: item.p!.length ? item.p!.concat(this.p) : this.p }
              : item;
          },
          path,
        };
      }, count - 1)
    : getItem;

type GenerateArr<
  Length extends number,
  Result extends any[] = [],
> = Result['length'] extends Length
  ? Result
  : GenerateArr<Length, [...Result, any]>;

type AnyOptions = { load(...args: any[]): any };

type DefaultCount<Keys> = Keys extends any[] ? Keys['length'] : 1;

type CommonStateArgs<State, C extends number> = [
  createState: () => State,
  ...args: C extends 1 ? [deepness?: C] : [deepness: C],
];

type LoadableStateArgs<State, Keys extends any[], O extends AnyOptions> = [
  createState: (options: O) => State,
  options: Omit<O, 'load'> & {
    load(...args: Keys): ReturnType<O['load']>;
  },
];

const createStateStorage: {
  <T, E, O extends AnyOptions, Keys extends any[]>(
    ...args: LoadableStateArgs<LoadableAsyncNestedState<T, E>, Keys, O>
  ): NestedStateStorage<Keys, LoadableAsyncNestedState<T, E, Keys>>;
  <T, E, O extends AnyOptions, Keys extends any[]>(
    ...args: LoadableStateArgs<LoadableAsyncState<T, E>, Keys, O>
  ): NestedStateStorage<Keys, LoadableAsyncState<T, E, Keys>>;
  <T, E, O extends AnyOptions, Keys extends any[]>(
    ...args: LoadableStateArgs<PausableLoadableAsyncNestedState<T, E>, Keys, O>
  ): NestedStateStorage<Keys, PausableLoadableAsyncNestedState<T, E, Keys>>;
  <T, E, O extends AnyOptions, Keys extends any[]>(
    ...args: LoadableStateArgs<PausableLoadableAsyncState<T, E>, Keys, O>
  ): NestedStateStorage<Keys, PausableLoadableAsyncState<T, E, Keys>>;
  <
    T,
    Keys extends GenerateArr<C>,
    E = any,
    C extends number = DefaultCount<Keys>,
  >(
    ...args: CommonStateArgs<AsyncNestedState<T, E>, C>
  ): NestedStateStorage<Keys, AsyncNestedState<T, E, Keys>>;
  <
    T,
    Keys extends GenerateArr<C>,
    E = any,
    C extends number = DefaultCount<Keys>,
  >(
    ...args: CommonStateArgs<AsyncState<T, E>, C>
  ): NestedStateStorage<Keys, AsyncState<T, E, Keys>>;
  <T, Keys extends GenerateArr<C>, C extends number = DefaultCount<Keys>>(
    ...args: CommonStateArgs<NestedState<T>, C>
  ): NestedStateStorage<Keys, NestedState<T, Keys>>;
  <T, Keys extends GenerateArr<C>, C extends number = DefaultCount<Keys>>(
    ...args: CommonStateArgs<State<T>, C>
  ): NestedStateStorage<Keys, State<T, Keys>>;
} = (
  createState: (options?: AnyOptions) => AnyState,
  arg2?: number | AnyOptions
) => {
  const isLoadableState = typeof arg2 == 'object';

  return recursiveWrap(
    isLoadableState ? () => createState(arg2) : createState,
    isLoadableState ? arg2.load.length : arg2 || 1
  )();
};

export default createStateStorage;
