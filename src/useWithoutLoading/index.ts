import { useMemo } from 'react';
import type { LoadableState } from '../types';
import { get, set } from '../utils/state/wrapped';
import { createSubscribeWithError } from '../utils/createAsyncSubscribe';

const EMPTY_LOAD = { _load: undefined } as LoadableState;

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
      (state._root != state
        ? {
            _root: state._root,
            get: state.get,
            set: state.set,
            _onValueChange: state._onValueChange,
            _subscribeWithError: createSubscribeWithError(
              state._root._callbacks,
              state.error._callbacks,
              EMPTY_LOAD
            ),
            error: state.error,
            isLoaded: state.isLoaded,
            control: (state as any as LoadableState<any, any, any>).control,
            _path: state._path,
            _awaitOnly: state._awaitOnly,
          }
        : {
            _root: state as any,
            get,
            set,
            _onValueChange: state._onValueChange,
            _subscribeWithError: createSubscribeWithError(
              state._callbacks,
              state.error._callbacks,
              EMPTY_LOAD
            ),
            error: state.error,
            isLoaded: state.isLoaded,
            control: (state as any as LoadableState<any, any, any>).control,
          }) as LoadableState<any, any, any> as any,
    [state]
  );

export default useWithoutLoading;
