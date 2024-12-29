import { useEffect } from 'react';
import type {
  StateInitializer,
  LoadableState,
  PaginatedStorage,
  PollableStateOptions,
  RequestableStateOptions,
  WithInitModule,
  PollableState,
  LoadableStateScope,
  PollableStateScope,
  PaginatedStorageOptions,
} from '../types';
import onValueChange from '../onValueChange';
import alwaysFalse from '../utils/alwaysFalse';
import alwaysTrue from '../utils/alwaysTrue';
import type { PrimitiveOrNested } from 'keyweaver';
import type createRequestableState from '../createRequestableState';
import type createRequestableStateScope from '../createRequestableStateScope';
import type createPollableState from '../createPollableState';
import type createPollableStateScope from '../createPollableStateScope';
import useForceRerender from 'react-helpful-utils/useForceRerender';
import handleUnlisteners from '../utils/handleUnlisteners';
import concat from '../utils/concat';
import noop from 'lodash.noop';
import identity from 'lodash.identity';
import { _onValueChange, set, get } from '../utils/state/common';

function getItem(this: PaginatedStorage<any>, page: number) {
  const self = this;

  const { _storage: _pages } = self;

  if (_pages.has(page)) {
    return _pages.get(page);
  }

  const item = self._getItem(
    self._arg1,
    self._arg2,
    self._keys ? concat(self._keys, page) : [page],
    _tickStart,
    _tickEnd,
    self
  );

  _pages.set(page, item);

  return item;
}

function _delete(this: PaginatedStorage<any>, page: number) {
  this._storage.delete(page);
}

function _tickStart(this: LoadableState) {
  const self = this;

  const index = self._keys![self._keys!.length - 1];

  const parent = self._parent!;

  if (!parent._promise) {
    parent._promise = new Promise<void>((res) => {
      parent._resolve = res;
    });
  }

  parent._pages.add(index);

  parent._stableStorage.set(index, self._value);
}

function _tickEnd(this: LoadableState) {
  const self = this;

  const parent = self._parent!;

  if (
    parent._promise &&
    parent._pages.delete(self._keys![self._keys!.length - 1]) &&
    !parent._pages.size
  ) {
    parent._stableStorage.clear();

    parent._promise = parent._resolve() as undefined;
  }
}

function usePages(
  this: PaginatedStorage<LoadableState | LoadableStateScope>,
  getState: (scope: any) => LoadableState = identity
) {
  const self = this;

  const stableStorage = self._stableStorage;

  const count: number = self.page._value;

  const forceRerender = useForceRerender();

  const values = new Array(count);

  const errors = new Array(count);

  for (let i = 0; i < count; i++) {
    let state = getState(self.get(i));

    errors[i] = state.error.get();

    if (stableStorage.has(i)) {
      const _value = stableStorage.get(i);

      state = {
        _root: { _value },
        _value,
        get: state.get,
        _path: state._path,
      } as LoadableState;
    }

    values[i] = state.get();
  }

  useEffect(() => {
    let prevPage = count;

    let isCallable = true;

    const cleanupMap = new Map<number, () => void>();

    const callback = () => {
      if (self._promise) {
        if (isCallable) {
          isCallable = false;

          self._promise.then(() => {
            isCallable = true;

            forceRerender();
          });
        }
      } else {
        forceRerender();
      }
    };

    for (let i = 0; i < prevPage; i++) {
      const state = getState(self.get(i));

      cleanupMap.set(
        i,
        handleUnlisteners(onValueChange([state, state.error], callback), state)
      );
    }

    const unlisten = self.page._onValueChange((nextPage: number) => {
      if (nextPage > prevPage) {
        if (!self._promise) {
          const { shouldRevalidate: _shouldRevalidate } = self._arg1;

          const shouldRevalidate = _shouldRevalidate
            ? _shouldRevalidate != true
              ? _shouldRevalidate
              : alwaysTrue
            : alwaysFalse;

          for (let i = 0; i < prevPage; i++) {
            const item = self.get(i);

            const state = getState(item);

            if (shouldRevalidate(item)) {
              const prev = cleanupMap.get(i)!;

              cleanupMap.set(i, state.load(true));

              prev();
            } else if ((state as PollableState<any>).control) {
              (state as PollableState<any>).control.reset();
            }
          }
        }

        for (let i = prevPage; i < nextPage; i++) {
          const state = getState(self.get(i));

          cleanupMap.set(
            i,
            handleUnlisteners(
              onValueChange([state, state.error], callback),
              state
            )
          );
        }
      } else {
        for (let i = nextPage; i < prevPage; i++) {
          cleanupMap.get(i)!();

          cleanupMap.delete(i);
        }
      }

      forceRerender();
    });

    return () => {
      unlisten();

      for (let i = 0; i < prevPage; i++) {
        cleanupMap.get(i)!();

        cleanupMap.delete(i);
      }
    };
  }, [self]);

  return [values, errors] as const;
}

type Args<CreateState, T, O> = WithInitModule<
  T,
  [createState: CreateState, options: O & PaginatedStorageOptions<T>]
>;

export type PaginatedRequestableStateArgs<
  T,
  E,
  Keys extends PrimitiveOrNested[] = [],
> = Args<
  typeof createRequestableState,
  T,
  RequestableStateOptions<T, E, [...Keys, page: number]>
>;

export type PaginatedRequestableNestedStateArgs<
  T,
  E,
  Keys extends PrimitiveOrNested[] = [],
> = Args<
  typeof createRequestableStateScope,
  T,
  RequestableStateOptions<T, E, [...Keys, page: number]>
>;

export type PaginatedPollableStateArgs<
  T,
  E,
  Keys extends PrimitiveOrNested[] = [],
> = Args<
  typeof createPollableState,
  T,
  PollableStateOptions<T, E, [...Keys, page: number]>
>;

export type PaginatedPollableNestedStateArgs<
  T,
  E,
  Keys extends PrimitiveOrNested[] = [],
> = Args<
  typeof createPollableStateScope,
  T,
  PollableStateOptions<T, E, [...Keys, page: number]>
>;

/**
 * Creates a paginated state storage to manage and load data efficiently across multiple pages.
 * The created storage allows the loading and handling of data in a paginated structure, with support
 * for {@link createRequestableState requestable} and {@link createPollableState pollable} states.
 */
const createPaginatedStorage: {
  <T, Error = any>(
    ...args: PaginatedRequestableStateArgs<T, Error>
  ): PaginatedStorage<LoadableState<T, Error>>;
  <T, Error = any>(
    ...args: PaginatedRequestableNestedStateArgs<T, Error>
  ): PaginatedStorage<LoadableStateScope<T, Error>>;

  <T, Error = any>(
    ...args: PaginatedPollableStateArgs<T, Error>
  ): PaginatedStorage<PollableState<T, Error>>;
  <T, Error = any>(
    ...args: PaginatedPollableNestedStateArgs<T, Error>
  ): PaginatedStorage<PollableStateScope<T, Error>>;
} = (
  createState: any,
  options: PaginatedStorageOptions<any>,
  stateInitializer?: StateInitializer,
  keys?: any[]
): any =>
  ({
    _storage: new Map(),
    _pages: new Set(),
    _stableStorage: new Map(),
    page: {
      _onValueChange,
      _value: 1,
      get,
      set,
      _setData: new Set(),
    } as PaginatedStorage<any>['page'],
    _getItem: createState,
    _arg1: options,
    _arg2: stateInitializer,
    get: getItem,
    delete: _delete,
    _promise: undefined,
    _resolve: noop,
    _keys: keys,
    usePages,
  }) as PaginatedStorage<any>;

export type { PaginatedStorage };

export default createPaginatedStorage;
