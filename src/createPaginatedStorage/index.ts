import { useEffect } from 'react';
import getValue from '../getValue';
import type {
  AnyLoadableState,
  ControllableLoadableNestedState,
  ControllableLoadableState,
  StateInitializer,
  Internal,
  StateInternalUtils,
  LoadableNestedState,
  LoadableState,
  PaginatedStateStorage,
  PaginatedStorageUtils,
  PollableStateOptions,
  RequestableStateOptions,
  WithInitModule,
} from '../types';
import { EMPTY_ARR } from '../utils/constants';
import onValueChange from '../onValueChange';
import useConst from 'react-helpful-utils/useConst';
import alwaysFalse from '../utils/alwaysFalse';
import alwaysTrue from '../utils/alwaysTrue';
import type { PrimitiveOrNested } from 'keyweaver';
import scope from '../utils/scope';
import type createRequestableState from '../createRequestableState';
import type createRequestableStateScope from '../createRequestableStateScope';
import type createPollableState from '../createPollableState';
import type createPollableStateScope from '../createPollableStateScope';
import { useForceRerender } from 'react-helpful-utils';
import getPromise from '../getPromise';
import handleUnlisteners from '../utils/handleUnlisteners';
import concat from '../utils/concat';

type AdditionalUtils = {
  readonly _parent: PaginatedStateStorage<any>['_internal'];
  _originalSet: StateInternalUtils['_set'];
  readonly _page: number;
  readonly _stable: Pick<StateInternalUtils, '_get' | '_value'>;
};

type PaginatedState = AnyLoadableState & Internal<AdditionalUtils>;

function _set(
  this: PaginatedState['_internal'],
  nextValue: any,
  path: string[],
  isError: boolean
) {
  this._originalSet(nextValue, path, isError);

  this._parent._resolvePage(this._page);
}

function get(this: PaginatedStateStorage<any, any[]>, page: number) {
  const keys = this.keys.length ? concat(this.keys, page) : [page];

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
    _originalSet: undefined!,
    _stable: { _value: undefined, _get: undefined! },
  } as AdditionalUtils);

  const utils = state._internal;

  utils._originalSet = utils._set;

  utils._set = _set;

  utils._stable._get = utils._get;

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

  utils._stable._value = utils._value;
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
    const paginationUtils = this._internal;

    const { _shouldRevalidate: shouldRevalidate } = paginationUtils;

    const cleanupMap = new Map<number, () => void>();

    let prevFrom: null | number = null;

    let prevTo: null | number = null;

    let inProgress = true;

    return (from: number, to: number) => {
      let isUnstable = false;

      const states: PaginatedState[] = [];

      const errors: any[] = [];

      const forceRerender = useForceRerender();

      inProgress = true;

      useEffect(() => {
        const fromDiff = prevFrom != null ? prevFrom - from : 0;

        const toDiff = prevTo != null ? to - prevTo : to;

        const callback = () => {
          if (inProgress) {
            inProgress = false;

            const l = states.length;

            let inProgressCount = l;

            const onDone = () => {
              if (!--inProgressCount) {
                forceRerender();
              }
            };

            for (let i = 0; i < l; i++) {
              getPromise(states[i], true).then(onDone, onDone);
            }
          }
        };

        if (fromDiff) {
          if (fromDiff > 0) {
            for (let i = 0; i < fromDiff; i++) {
              const state = states[i];

              cleanupMap.set(
                from + i,
                handleUnlisteners(
                  onValueChange([state, state.error], callback),
                  state
                )
              );
            }

            if (!isUnstable) {
              for (let i = fromDiff; i < states.length; i++) {
                const state = states[i];

                if (shouldRevalidate(state)) {
                  const page = from + i;

                  const prev = cleanupMap.get(page)!;

                  cleanupMap.set(page, state.load(true));

                  prev();
                } else if ('reset' in state.loading) {
                  state.loading.reset();
                }
              }
            }
          } else {
            for (let i = prevFrom!; i < from; i++) {
              cleanupMap.get(i)!();

              cleanupMap.delete(i);
            }
          }
        }

        if (toDiff) {
          if (toDiff > 0) {
            const start = prevTo != null ? prevTo - prevFrom! : 0;

            if (start && !isUnstable) {
              for (let i = 0; i < start; i++) {
                const state = states[i];

                if (shouldRevalidate(state)) {
                  const page = from + i;

                  const prev = cleanupMap.get(page)!;

                  cleanupMap.set(page, state.load(true));

                  prev();
                } else if ('reset' in state.loading) {
                  state.loading.reset();
                }
              }
            }

            for (let i = start; i < states.length; i++) {
              const state = states[i];

              cleanupMap.set(
                from + i,
                handleUnlisteners(
                  onValueChange([state, state.error], callback),
                  state
                )
              );
            }
          } else {
            for (let i = prevTo!; i < to; i++) {
              cleanupMap.get(i)!();

              cleanupMap.delete(i);
            }
          }
        }

        prevFrom = from;

        prevTo = to;
      }, [from, to, paginationUtils]);

      useEffect(
        () => () => {
          for (let i = prevFrom!; i < prevTo!; i++) {
            cleanupMap.get(i)!();

            cleanupMap.delete(i);
          }

          prevFrom = prevTo = null;
        },
        [paginationUtils]
      );

      for (let i = from; i < to; i++) {
        const state: PaginatedState = this.get(i);

        if (state.loading._isFetchInProgress) {
          isUnstable = true;
        }

        errors.push(getValue(state.error));

        states.push(state);
      }

      return [
        states.map(
          isUnstable
            ? (item) => item._internal._stable._get(item._path!)
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
  typeof createRequestableStateScope,
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
  typeof createPollableStateScope,
  T,
  PollableStateOptions<T, E, [...ParentKeys, ...Keys, page: number]>
>;

/**
 * Creates a paginated state storage to manage and load data efficiently across multiple pages.
 * The created storage allows the loading and handling of data in a paginated structure, with support
 * for {@link createRequestableState requestable} and {@link createPollableState pollable} states.
 */
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
  stateInitializer?: StateInitializer
): any => {
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
      _arg2: stateInitializer,
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
    scope,
    _path: EMPTY_ARR,
    keys: EMPTY_ARR,
    usePages,
  } as Partial<
    PaginatedStateStorage<any, any[]>
  > as PaginatedStateStorage<ControllableLoadableNestedState>;
};

export type { PaginatedStateStorage };

export default createPaginatedStorage;
