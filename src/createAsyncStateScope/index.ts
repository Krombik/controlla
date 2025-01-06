import type {
  AsyncStateScope,
  AsyncStateOptions,
  LoadableStateScope,
  LoadableStateOptions,
  StateInitializer,
} from '../types';
import createScope from '../utils/createScope';
import getAsyncState from '../utils/getAsyncState';
import { set } from '../utils/state/scope';

const createAsyncStateScope: {
  /**
   * Creates a {@link LoadableNestedState loadable nested state} with basic loading capabilities.
   *
   * * @example
   * ```js
   * const loadableState = createAsyncNestedState({
   *   load: () => {} // loading logic
   * });
   * ```
   */
  <T, E = any, Control = never>(
    options: LoadableStateOptions<T, E, Control>,
    stateInitializer?: StateInitializer<T>
  ): LoadableStateScope<T, E>;
  /**
   * Creates a {@link AsyncNestedState basic asynchronous nested state}
   *
   * @example
   * ```js
   * const asyncState = createAsyncNestedState();
   * ```
   */
  <T, E = any>(
    options?: AsyncStateOptions<T, E>,
    stateInitializer?: StateInitializer<T>
  ): AsyncStateScope<T, E>;
} = (
  options: LoadableStateOptions<any, any, any, any[]>,
  stateInitializer?: StateInitializer,
  keys?: any[]
) =>
  createScope(
    getAsyncState(
      set,
      options || {},
      stateInitializer,
      keys,
      options && options.load,
      options && options.Control
    )
  );

export type { AsyncStateScope, LoadableStateScope };

export default createAsyncStateScope;
