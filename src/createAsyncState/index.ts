import type {
  AsyncState,
  AsyncStateOptions,
  LoadableState,
  LoadableStateOptions,
  StateInitializer,
  ValueChangeCallbacks,
} from '../types';

import getAsyncState from '../utils/getAsyncState';

import { set, _onValueChange, get } from '../utils/state/common';

const createAsyncState = ((
  options: LoadableStateOptions<any, any, any>,
  stateInitializer?: StateInitializer,
  keys?: any[]
) =>
  getAsyncState<ValueChangeCallbacks>(
    get,
    set,
    _onValueChange,
    options,
    stateInitializer,
    keys,
    new Set(),
    options.load,
    options.Control
  )) as {
  /**
   * Creates a {@link LoadableState loadable state} with basic loading capabilities.
   *
   * @example
   * ```js
   * const loadableState = createAsyncState({
   *   load: () => {} // loading logic
   * });
   * ```
   */
  <T, E = any, Control = never>(
    options: LoadableStateOptions<T, E, Control>,
    stateInitializer?: StateInitializer<T>
  ): LoadableState<T, E, Control>;
  /**
   * Creates a {@link AsyncState basic asynchronous state}
   *
   * @example
   * ```js
   * const asyncState = createAsyncState();
   * ```
   */
  <T, E = any>(
    options?: AsyncStateOptions<T, E>,
    stateInitializer?: StateInitializer<T>
  ): AsyncState<T, E>;
};

export type { AsyncState, LoadableState };

export default createAsyncState;
