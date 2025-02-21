import { useMemo } from 'react';
import type { LoadableState } from '../types';
import { createSubscribeWithError } from '../utils/createAsyncSubscribe';

/**
 * A utility function to prevent hooks from triggering the loading behavior of a {@link state}.
 * Wrapping a {@link state} with this function ensures that hooks like `useValue` or `use`
 * will not initiate the loading, allowing you to access the current value without triggering a load.
 */
const useWithoutLoading = <S extends LoadableState>(
  state: S
): Omit<S, 'load'> =>
  useMemo(
    () =>
      Object.create(state, {
        _subscribeWithError: {
          value: createSubscribeWithError(
            state._root._callbacks,
            state.error._callbacks,
            { _load: undefined } as LoadableState
          ),
        },
        _subscribeWithLoad: {
          value: undefined,
        },
        load: {
          value: undefined,
        },
      }),
    [state]
  );

export default useWithoutLoading;
