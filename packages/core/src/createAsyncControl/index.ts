import type {
  AsyncControl,
  AsyncControlOptions,
  LoadableControl,
  LoadableControlOptions,
  SyncExternalStorage,
} from '#types';
import { ROOT } from '#shared/constants';

import getAsyncControl from '#utils/getAsyncControl';

import { set } from '#utils/control/common';

const createAsyncControl = ((
  options: LoadableControlOptions<any, any, any>,
  syncExternalStorage?: SyncExternalStorage,
  keys?: any[]
) => ({
  [ROOT]: getAsyncControl(
    set,
    options || {},
    options && options.load,
    keys,
    syncExternalStorage,
    options && options.LoadingProcess
  ),
})) as {
  /**
   * Creates a {@link LoadableControl loadable control} with basic loading capabilities.
   *
   * @example
   * ```js
   * const loadableControl = createAsyncControl({
   *   load: () => {} // loading logic
   * });
   * ```
   */
  <T, E = any, LoadingProcess = never>(
    options: LoadableControlOptions<T, E, LoadingProcess>,
    syncExternalStorage?: SyncExternalStorage<T | undefined>
  ): LoadableControl<T, E, LoadingProcess>;
  /**
   * Creates a {@link AsyncControl basic asynchronous control}
   *
   * @example
   * ```js
   * const asyncControl = createAsyncControl();
   * ```
   */
  <T, E = any>(
    options?: AsyncControlOptions<T>,
    syncExternalStorage?: SyncExternalStorage<T | undefined>
  ): AsyncControl<T, E>;
};

export default createAsyncControl;
