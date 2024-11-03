import createNestedState from '../createNestedState';
import type {
  AsyncNestedState,
  AsyncStateOptions,
  LoadableNestedState,
  LoadableStateOptions,
  ControllableLoadableNestedState,
  ControllableLoadableStateOptions,
  StateInitializer,
} from '../types';
import getAsyncStateCreator from '../utils/getAsyncStateCreator';

const createAsyncNestedState = getAsyncStateCreator(createNestedState) as {
  /**
   * Creates a {@link ControllableLoadableNestedState controllable loadable nested state} that provides full control over the
   * loading process, including methods to pause, resume, and reset.
   *
   *  * @example
   * ```js
   * const controllableState = createAsyncNestedState({
   *   load: () => {}, // loading logic
   *   pause: () => {}, // pause logic
   *   resume: () => {}, // resume logic
   *   reset: () => {} // reset logic
   * });
   * ```
   */
  <T, E = any>(
    options: ControllableLoadableStateOptions<T, E>,
    stateInitializer?: StateInitializer<T>
  ): ControllableLoadableNestedState<T, E>;
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
  <T, E = any>(
    options: LoadableStateOptions<T, E>,
    stateInitializer?: StateInitializer<T>
  ): LoadableNestedState<T, E>;
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
  ): AsyncNestedState<T, E>;
};

export type {
  AsyncNestedState,
  LoadableNestedState,
  ControllableLoadableNestedState,
};

export default createAsyncNestedState;
