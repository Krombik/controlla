import type {
  RequestableControlOptions,
  LoadableControlScope,
  SyncExternalStorage,
} from '#types';
import createScope from '#internal/createScope';
import createAsyncRoot from '#internal/createAsyncRoot';
import { AsyncControlInternals } from '#internal/types';
import { INTERNALS } from '#shared-internal/constants';

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
) => {
  const { fetch } = options;

  return createScope(
    createAsyncRoot(
      options,
      function (this: LoadableControlScope, ...args: any[]) {
        const internals = this[INTERNALS] as AsyncControlInternals;

        fetch(...args).then(
          (value) => {
            internals._enqueueSet(value);
          },
          (err) => internals._errorControl[INTERNALS]._enqueueSet(err)
        );
      },
      keys,
      syncExternalStorage
    )
  );
};

export default createRequestableControl;
