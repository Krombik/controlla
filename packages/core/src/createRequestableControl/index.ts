import type {
  RequestableControlOptions,
  LoadableControlScope,
  SyncExternalStorage,
} from '#types';
import createLoadRunner from '#internal/createLoadRunner';
import createScope from '#internal/createScope';
import createAsyncRoot from '#internal/createAsyncRoot';

const loadOnce: Parameters<typeof createLoadRunner>[0] = (load) => load();

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
    createAsyncRoot(
      options,
      createLoadRunner(loadOnce, options.fetch),
      keys,
      syncExternalStorage
    )
  );

export default createRequestableControl;
