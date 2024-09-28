import { useEffect, useState } from 'react';
import getValue from '../getValue';
import {
  AnyLoadableState,
  ControllableNestedState,
  ControllableState,
  Internal,
  InternalUtils,
  Key,
  LoadableNestedState,
  LoadableState,
  PaginatedStateStorage,
  PaginatedStorageUtils,
  PollableStateOptions,
  RequestableStateOptions,
} from '../types';
import { EMPTY_ARR, RootKey } from '../utils/constants';
import onValueChange from '../onValueChange';
import useConst from 'react-helpful-utils/useConst';
import alwaysFalse from '../utils/alwaysFalse';
import alwaysTrue from '../utils/alwaysTrue';
import { PrimitiveOrNested } from 'keyweaver';
import path from '../utils/path';
import createRequestableState from '../createRequestableState';
import createRequestableNestedState from '../createRequestableNestedState';
import createPollableState from '../createPollableState';
import createPollableNestedState from '../createPollableNestedState';

type PaginatedState = LoadableState<any> &
  Internal<{
    _parent: PaginatedStateStorage<any>['_internal'];
    _originalSet: InternalUtils['_set'];
    _page: number;
  }>;

const handleListener = (
  state: AnyLoadableState<any>,
  forceRerender: () => void
) => {
  const unlistenValue = onValueChange(state, forceRerender);

  const unregister = state.load();

  return () => {
    unlistenValue();

    unregister();
  };
};

function _set(
  this: PaginatedState['_internal'],
  nextValue: any,
  isSet: boolean,
  path: Key[],
  isError: boolean
) {
  this._originalSet(nextValue, isSet, path, isError);

  this._parent._resolvePage(this._page);
}

function get(this: PaginatedStateStorage<any, any[]>, page: number) {
  const keys = this.keys ? this.keys.concat(page) : [page];

  return {
    ...this._internal._get(page, keys),
    keys,
  };
}

function _get(
  this: PaginatedStorageUtils,
  page: number,
  keys: PrimitiveOrNested[]
) {
  const storage = this._storage;

  if (storage.has(page)) {
    return storage.get(page)!;
  }

  const state: PaginatedState = this._getItem(this._options, keys);

  state._internal = {
    ...state._internal,
    _originalSet: state._internal._set,
    _page: page,
    _set,
  };

  storage.set(page, state);

  return state;
}

function _resolvePage(this: PaginatedStorageUtils, page: number) {
  if (this._pages.delete(page) && !this._pages.size) {
    this._resolve();

    this._promise = new Promise((res) => {
      this._resolve = res;
    });
  }
}

function _delete(this: PaginatedStateStorage<any>, page: number) {
  this._internal._storage.delete(page);
}

const _beforeLoad = (args: any[], utils: PaginatedState['_internal']) => {
  utils._parent._pages.add(args[args.length - 1] as number);

  utils._data.set(RootKey.STABLE_VALUE, utils._data.get(RootKey.VALUE));
};

const _afterLoad = async (
  args: any[] | void,
  utils: PaginatedState['_internal']
) => {
  if (args) {
    const self = utils._parent;

    self._resolvePage(args[args.length - 1] as number);

    await self._promise;

    return args;
  }
};

function usePages(
  this: PaginatedStateStorage<any, any[]>,
  from: number,
  to?: number
) {
  if (to == null) {
    to = from;

    from = 0;
  }

  return useConst(() => {
    const { _pages: pages, _shouldRevalidate: shouldRevalidate } =
      this._internal;

    const cleanupMap = new Map<number, () => void>();

    let prevFrom = from;

    let prevTo = from;

    return (from: number, to: number) => {
      let isUnstable = false;

      const arr: AnyLoadableState<any>[] = [];

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
              for (let i = fromDiff; i < arr.length; i++) {
                const state = arr[i];

                if (shouldRevalidate(state)) {
                  state.load(true);
                } else if ('reset' in state) {
                  state.reset();
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
              for (let i = 0; i < start; i++) {
                const state = arr[i];

                if (shouldRevalidate(state)) {
                  state.load(true);
                } else if ('reset' in state) {
                  state.reset();
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
        const state: AnyLoadableState<any> = this.get(i);

        if (state._internal._isFetchInProgress) {
          isUnstable = true;
        }

        arr.push(state);
      }

      return arr.map(
        isUnstable
          ? (item) => item._internal._data.get(RootKey.STABLE_VALUE)
          : getValue
      );
    };
  })(from, to);
}

type Options<T> = {
  shouldRevalidate?: boolean | ((value: T | undefined) => boolean);
};

const createPaginatedStorage: {
  <T, Error = any>(
    createState: typeof createRequestableState,
    options: RequestableStateOptions<T, Error> & Options<T>
  ): PaginatedStateStorage<LoadableState<T, Error>>;
  <T, Error = any>(
    createState: typeof createRequestableNestedState,
    options: RequestableStateOptions<T, Error> & Options<T>
  ): PaginatedStateStorage<LoadableNestedState<T, Error>>;

  <T, Error = any>(
    createState: typeof createPollableState,
    options: PollableStateOptions<T, Error> & Options<T>
  ): PaginatedStateStorage<ControllableState<T, Error>>;
  <T, Error = any>(
    createState: typeof createPollableNestedState,
    options: PollableStateOptions<T, Error> & Options<T>
  ): PaginatedStateStorage<ControllableNestedState<T, Error>>;
} = (
  createState: any,
  options: RequestableStateOptions<any> & Options<any>
) => {
  const { shouldRevalidate } = options;

  let resolve!: () => void;

  return {
    _internal: {
      _get,
      _getItem: createState,
      _options: {
        ...options,
        _beforeLoad,
        _afterLoad,
      },
      _pages: new Set(),
      _promise: new Promise((res) => {
        resolve = res;
      }),
      _resolve: resolve,
      _shouldRevalidate: shouldRevalidate
        ? shouldRevalidate != true
          ? (state) => shouldRevalidate(getValue(state))
          : alwaysTrue
        : alwaysFalse,
      _storage: new Map(),
      _resolvePage,
    },
    get,
    delete: _delete,
    path,
    _path: EMPTY_ARR,
    keys: EMPTY_ARR,
    use: usePages,
  } as Partial<PaginatedStateStorage<any, any[]>> as PaginatedStateStorage<
    ControllableNestedState<any>
  >;
};

export default createPaginatedStorage;
