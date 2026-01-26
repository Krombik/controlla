import type {
  AsyncControlScope,
  AsyncControlOptions,
  LoadableControlScope,
  LoadableControlOptions,
  SyncExternalStorage,
} from '#types';
import createScope from '#internal/createScope';
import createAsyncRoot from '#internal/createAsyncRoot';

const createAsyncControl: {
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
    options
      ? createAsyncRoot(
          options,
          options.load,
          keys,
          syncExternalStorage,
          options.LoadingProcess
        )
      : createAsyncRoot({}, undefined, keys, syncExternalStorage)
  );

export default createAsyncControl;
