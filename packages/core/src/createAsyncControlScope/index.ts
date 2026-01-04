import type {
  AsyncControlScope,
  AsyncControlOptions,
  LoadableControlScope,
  LoadableControlOptions,
  SyncExternalStorage,
} from '#types';
import createScope from '#utils/createScope';
import getAsyncControl from '#utils/getAsyncControl';
import { set } from '#utils/control/scope';

const createAsyncControlScope: {
  /**
   * Creates a {@link LoadableControlScope loadable nested control} with basic loading capabilities.
   *
   * * @example
   * ```js
   * const loadableControl = createAsyncNestedControl({
   *   load: () => {} // loading logic
   * });
   * ```
   */
  <T, E = any, LoadingProcess = never>(
    options: LoadableControlOptions<T, E, LoadingProcess>,
    syncExternalStorage?: SyncExternalStorage<T | undefined>
  ): LoadableControlScope<T, E>;
  /**
   * Creates a {@link AsyncControlScope basic asynchronous nested control}
   *
   * @example
   * ```js
   * const asyncControl = createAsyncNestedControl();
   * ```
   */
  <T, E = any>(
    options?: AsyncControlOptions<T>,
    syncExternalStorage?: SyncExternalStorage<T | undefined>
  ): AsyncControlScope<T, E>;
} = (
  options: LoadableControlOptions<any, any, any, any[]>,
  syncExternalStorage?: SyncExternalStorage,
  keys?: any[]
) =>
  createScope(
    getAsyncControl(
      set,
      options || {},
      options && options.load,
      keys,
      syncExternalStorage,
      options && options.LoadingProcess
    )
  );

export default createAsyncControlScope;
