import { useMemo } from 'react';
import type { AsyncState, InternalAsyncState, LoadableState } from '../types';
import { createSubscribeWithError } from '../utils/createAsyncSubscribe';
import { ROOT } from '../utils/constants';

/**
 * A utility function to prevent hooks from triggering the loading behavior of a {@link state}.
 * Wrapping a {@link state} with this function ensures that hooks like `useValue` or `use`
 * will not initiate the loading, allowing you to access the current value without triggering a load.
 */
const useWithoutLoading = <Value, Error>(
  state: LoadableState<Value, Error>
): AsyncState<Value, Error> =>
  useMemo(() => {
    const utils = state[ROOT];

    return {
      [ROOT]: Object.create(utils, {
        _subscribeWithError: {
          value: createSubscribeWithError(
            utils._callbacks,
            utils._errorState[ROOT]._callbacks,
            { [ROOT]: {} } as InternalAsyncState
          ),
        },
        _subscribeWithLoad: {
          value: undefined,
        },
      }),
    } as AsyncState;
  }, [state]);

export default useWithoutLoading;
