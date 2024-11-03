import createState from '../createState';
import type {
  AsyncState,
  AsyncStateOptions,
  LoadableState,
  LoadableStateOptions,
  ControllableLoadableState,
  ControllableLoadableStateOptions,
  StateInitializer,
} from '../types';
import getAsyncStateCreator from '../utils/getAsyncStateCreator';

const createAsyncState = getAsyncStateCreator(createState) as {
  /**
   * Creates a {@link ControllableLoadableState controllable loadable state} that provides full control over the
   * loading process, including methods to pause, resume, and reset.
   *
   * @example
   * ```js
   * const controllableState = createAsyncState({
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
  ): ControllableLoadableState<T, E>;
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
  <T, E = any>(
    options: LoadableStateOptions<T, E>,
    stateInitializer?: StateInitializer<T>
  ): LoadableState<T, E>;
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

export type { AsyncState, LoadableState, ControllableLoadableState };

export default createAsyncState;
