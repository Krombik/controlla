import type {
  RequestableControlOptions,
  LoadableControlScope,
  SyncExternalStorage,
} from '#types';
import createLoader from '#utils/createLoader';
import createScope from '#utils/createScope';
import getAsyncControl from '#utils/getAsyncControl';
import { handleFetch } from '#utils/handleFetch';

const createRequestableControl: {
  /**
   * Creates a {@link LoadableControlScope loadable control scope} that supports asynchronous data loading on request.
   * The created control manages loading and error handling for data requests, providing
   * a flexible way to manage request-based control updates.
   */
  <T, E = any>(
    options: RequestableControlOptions<T>,
    syncExternalStorage?: SyncExternalStorage<T | undefined>
  ): LoadableControlScope<T, E>;
} = (
  options: RequestableControlOptions<any, any[]>,
  syncExternalStorage?: SyncExternalStorage,
  keys?: any[]
) =>
  createScope(
    getAsyncControl(
      options,
      createLoader(handleFetch, options.fetch),
      keys,
      syncExternalStorage
    )
  );

export default createRequestableControl;
