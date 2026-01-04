import type {
  LoadableControl,
  RequestableControlOptions,
  SyncExternalStorage,
} from '#types';
import { ROOT } from '#shared/constants';
import createLoader from '#utils/createLoader';
import getAsyncControl from '#utils/getAsyncControl';
import { handleFetch } from '#utils/handleFetch';
import { set } from '#utils/control/common';

const createRequestableControl = ((
  options: RequestableControlOptions<any, any, any[]>,
  syncExternalStorage?: SyncExternalStorage,
  keys?: any[],
  tickStart?: () => void,
  tickEnd?: () => void
) => ({
  [ROOT]: getAsyncControl(
    set,
    options,
    createLoader(handleFetch, options),
    keys,
    syncExternalStorage,
    undefined,
    tickStart,
    tickEnd
  ),
})) as {
  /**
   * Creates a {@link LoadableControl loadable control} that supports asynchronous data loading on request.
   * The created control manages loading and error handling for data requests, providing
   * a flexible way to manage request-based control updates.
   */
  <T, E = any>(
    options: RequestableControlOptions<T, E>,
    syncExternalStorage?: SyncExternalStorage<T | undefined>
  ): LoadableControl<T, E>;
};

export default createRequestableControl;
