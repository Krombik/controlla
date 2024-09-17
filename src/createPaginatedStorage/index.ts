import { useEffect, useState } from 'react';
import getValue from '../getValue';
import {
  AnyLoadableState,
  RequestableStateOptions,
  StatePath,
  StateStorage,
} from '../types';
import { EMPTY_ARR, RootKey } from '../utils/constants';
import onValueChange from '../onValueChange';
import useConst from 'react-helpful-utils/useConst';
import alwaysFalse from '../utils/alwaysFalse';
import reload from '../reload';
import reset from '../reset';
import load from '../load';

const handleListener = <Keys extends [...any[], number]>(
  state: AnyLoadableState<any, any, Keys>,
  forceRerender: () => void
) => {
  const unlistenValue = onValueChange(state, forceRerender);

  const unregister = load(state);

  return () => {
    unlistenValue();

    unregister();
  };
};

type Options<T, Error, Keys extends any[]> = RequestableStateOptions<
  T,
  Error,
  Keys
> & {
  revalidateAll?: boolean | ((value: T | undefined) => boolean);
};

const createPaginatedStorage = <Keys extends [...any[], number]>(
  createState: (
    options: Options<any, any, Keys>
  ) => AnyLoadableState<any, any, Keys>,
  options: Options<any, any, Keys>
): StateStorage<
  number,
  AnyLoadableState<any, any, Keys> & StatePath,
  any[]
> => {
  const { revalidateAll } = options;

  const pages = new Set<number>();

  const storage = new Map<number, AnyLoadableState<any, any, Keys>>();

  const resolvePage = (page: number) => {
    if (pages.delete(page) && !pages.size) {
      resolve();

      promise = new Promise((res) => {
        resolve = res;
      });
    }
  };

  const shouldRevalidate = revalidateAll
    ? revalidateAll != true
      ? (state?: AnyLoadableState) => revalidateAll(state && getValue(state))
      : () => true
    : alwaysFalse;

  let resolve!: () => void;

  let promise = new Promise<void>((res) => {
    resolve = res;
  });

  options = {
    ...options,
    _beforeLoad(args, { _r: root }) {
      pages.add(args[args.length - 1] as number);

      root.set(RootKey.STABLE_VALUE, root.get(RootKey.VALUE));
    },
    async _afterLoad(args) {
      if (args) {
        resolvePage(args[args.length - 1] as number);

        await promise;

        return args;
      }
    },
  };

  //@ts-ignore
  return {
    get(page) {
      let state;

      if (storage.has(page)) {
        state = storage.get(page)!;
      } else {
        state = createState(options);

        const root = state._r;

        const _set = root.get(RootKey.VALUE_SET)!;

        root.set(
          RootKey.VALUE_SET,
          (nextValue, rootValue, isSet, path, isError) => {
            _set(nextValue, rootValue, isSet, path, isError);

            resolvePage(page);
          }
        );

        storage.set(page, state);
      }

      return {
        ...state,
        a: this.a.length ? this.a.concat(page) : [page],
      } as any;
    },
    _get(keys, index) {
      return this.get<any>(keys[index]) as any;
    },
    a: EMPTY_ARR as any,
    _p: EMPTY_ARR,
    usePages(from: number, to?: number) {
      if (to == null) {
        to = from;

        from = 0;
      }

      return useConst(() => {
        const cleanupMap = new Map<number, () => void>();

        let prevFrom = from;

        let prevTo = from;

        return (from: number, to: number) => {
          let isUnstable = false;

          const arr: AnyLoadableState<any, any, Keys>[] = [];

          const t = useState<{}>();

          useEffect(() => {
            const fromDiff = prevFrom - from;

            const toDiff = to - prevTo;

            const forceRerender = t[1];

            const callback = () => {
              for (
                let i = from;
                (i < to || (forceRerender({}) as undefined)) && !pages.has(i);
                i++
              ) {}
            };

            if (fromDiff) {
              if (fromDiff > 0) {
                for (let i = 0; i < fromDiff; i++) {
                  cleanupMap.set(from + i, handleListener(arr[i], callback));
                }

                if (!isUnstable) {
                  const method = shouldRevalidate()
                    ? reload
                    : isResetable && reset;

                  if (method) {
                    for (let i = fromDiff; i < arr.length; i++) {
                      method(arr[i]);
                    }
                  }
                }
              } else {
                for (let i = prevFrom; i < from; i++) {
                  cleanupMap.get(i)!();

                  cleanupMap.delete(i);
                }
              }
            }

            if (toDiff) {
              if (toDiff > 0) {
                const start = prevTo - prevFrom;

                if (start && !isUnstable) {
                  const method = shouldRevalidate(arr[start - 1])
                    ? reload
                    : isResetable && reset;

                  if (method) {
                    for (let i = 0; i < start; i++) {
                      method(arr[i]);
                    }
                  }
                }

                for (let i = start; i < arr.length; i++) {
                  cleanupMap.set(from + i, handleListener(arr[i], callback));
                }
              } else {
                for (let i = prevTo; i < to; i++) {
                  cleanupMap.get(i)!();

                  cleanupMap.delete(i);
                }
              }
            }

            prevFrom = from;

            prevTo = to;
          }, [from, to]);

          useEffect(
            () => () => {
              for (let i = prevFrom; i < prevTo; i++) {
                cleanupMap.get(i)!();

                cleanupMap.delete(i);
              }
            },
            []
          );

          for (let i = from; i < to; i++) {
            const state = this.get<any>(i);

            if (state._r.get(RootKey.IS_FETCH_IN_PROGRESS)) {
              isUnstable = true;
            }

            arr.push(state);
          }

          let isResetable = arr.length && arr[0]._r.has(RootKey.RESET);

          return arr.map(
            isUnstable ? (item) => item._r.get(RootKey.STABLE_VALUE) : getValue
          );
        };
      })(from, to);
    },
  };
};

export default createPaginatedStorage;
