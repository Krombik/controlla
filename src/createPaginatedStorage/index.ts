import { useEffect, useState } from 'react';
import getValue from '../getValue';
import {
  AnyLoadableState,
  ControllableLoadableNestedState,
  ControllableLoadableState,
  InitModule,
  Internal,
  StateInternalUtils,
  PathKey,
  LoadableNestedState,
  LoadableState,
  PaginatedStateStorage,
  PaginatedStorageUtils,
  PollableStateOptions,
  RequestableStateOptions,
  WithInitModule,
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
    _originalSet: StateInternalUtils['_set'];
    _page: number;
  }>;

const handleListener = (
  state: AnyLoadableState<any>,
  forceRerender: () => void
) => {
  const unlistenValue = onValueChange(state, forceRerender);

  const unlistenError = onValueChange(state.error, forceRerender);

  const unregister = state.load();

  return () => {
    unlistenValue();

    unlistenError();

    unregister();
  };
};

function _set(
  this: PaginatedState['_internal'],
  nextValue: any,
  isSet: boolean,
  path: PathKey[],
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

  const state: PaginatedState = this._getItem(this._arg1, this._arg2, keys, {
    _parent: this,
    _page: page,
  } as {
    _parent: PaginatedStateStorage<any>['_internal'];
    _page: number;
  });

  state._internal._originalSet = state._internal._set;

  state._internal._set = _set;

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

      const states: AnyLoadableState<any>[] = [];

      const errors: any[] = [];

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
              cleanupMap.set(from + i, handleListener(states[i], callback));
            }

            if (!isUnstable) {
              for (let i = fromDiff; i < states.length; i++) {
                const state = states[i];

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
                const state = states[i];

                if (shouldRevalidate(state)) {
                  state.load(true);
                } else if ('reset' in state) {
                  state.reset();
                }
              }
            }

            for (let i = start; i < states.length; i++) {
              cleanupMap.set(from + i, handleListener(states[i], callback));
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

        errors.push(getValue(state.error));

        states.push(state);
      }

      return [
        states.map(
          isUnstable
            ? (item) => item._internal._data.get(RootKey.STABLE_VALUE)
            : getValue
        ),
        errors,
      ] as const;
    };
  })(from, to);
}

type Options<T> = {
  shouldRevalidate?: boolean | ((value: T | undefined) => boolean);
};

type Args<CreateState, T, O> = WithInitModule<
  T,
  [createState: CreateState, options: O & Options<T>]
>;

export type PaginatedRequestableStateArgs<
  T,
  E,
  Keys extends PrimitiveOrNested[] = [],
  ParentKeys extends PrimitiveOrNested[] = [],
> = Args<
  typeof createRequestableState,
  T,
  RequestableStateOptions<T, E, [...ParentKeys, ...Keys, page: number]>
>;

export type PaginatedRequestableNestedStateArgs<
  T,
  E,
  Keys extends PrimitiveOrNested[] = [],
  ParentKeys extends PrimitiveOrNested[] = [],
> = Args<
  typeof createRequestableNestedState,
  T,
  RequestableStateOptions<T, E, [...ParentKeys, ...Keys, page: number]>
>;

export type PaginatedPollableStateArgs<
  T,
  E,
  Keys extends PrimitiveOrNested[] = [],
  ParentKeys extends PrimitiveOrNested[] = [],
> = Args<
  typeof createPollableState,
  T,
  PollableStateOptions<T, E, [...ParentKeys, ...Keys, page: number]>
>;

export type PaginatedPollableNestedStateArgs<
  T,
  E,
  Keys extends PrimitiveOrNested[] = [],
  ParentKeys extends PrimitiveOrNested[] = [],
> = Args<
  typeof createPollableNestedState,
  T,
  PollableStateOptions<T, E, [...ParentKeys, ...Keys, page: number]>
>;

const createPaginatedStorage: {
  <T, Error = any>(
    ...args: PaginatedRequestableStateArgs<T, Error>
  ): PaginatedStateStorage<LoadableState<T, Error>>;
  <T, Error = any>(
    ...args: PaginatedRequestableNestedStateArgs<T, Error>
  ): PaginatedStateStorage<LoadableNestedState<T, Error>>;

  <T, Error = any>(
    ...args: PaginatedPollableStateArgs<T, Error>
  ): PaginatedStateStorage<ControllableLoadableState<T, Error>>;
  <T, Error = any>(
    ...args: PaginatedPollableNestedStateArgs<T, Error>
  ): PaginatedStateStorage<ControllableLoadableNestedState<T, Error>>;
} = (
  createState: any,
  options: RequestableStateOptions<any, any, [number]> & Options<any>,
  initModule?: InitModule
) => {
  const { shouldRevalidate } = options;

  let resolve!: () => void;

  return {
    _internal: {
      _get,
      _getItem: createState,
      _arg1: {
        ...options,
        _beforeLoad,
        _afterLoad,
      },
      _arg2: initModule,
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
    usePages,
  } as Partial<PaginatedStateStorage<any, any[]>> as PaginatedStateStorage<
    ControllableLoadableNestedState<any>
  >;
};

export default createPaginatedStorage;
