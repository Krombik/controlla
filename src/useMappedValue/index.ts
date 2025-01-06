import { useCallback, useSyncExternalStore } from 'react';
import type { AnyAsyncState, AsyncState, StateBase as State } from '../types';
import { postBatchCallbacksPush } from '../utils/batching';
import noop from 'lodash.noop';

const useMappedValue = ((
  state: AnyAsyncState,
  mapper: (value: any, isLoaded?: boolean, error?: any) => any
) => {
  const l = mapper.length;

  if (l < 2) {
    return useSyncExternalStore(
      state._subscribeWithLoad || state._onValueChange,
      () => mapper(state.get())
    );
  }

  const isLoadedState = state.isLoaded;

  const errorState = l > 2 && state.error;

  return useSyncExternalStore(
    useCallback(
      (cb) => {
        let isAvailable = true;

        const fn = () => {
          if (isAvailable) {
            isAvailable = false;

            postBatchCallbacksPush(() => {
              cb();

              isAvailable = true;
            });
          }
        };

        const unlistenValue = (
          state._subscribeWithLoad || state._onValueChange
        )(fn);

        const unlistenIsLoaded = isLoadedState._onValueChange(fn);

        const unlistenError = errorState ? errorState._onValueChange(fn) : noop;

        return () => {
          unlistenValue();

          unlistenIsLoaded();

          unlistenError();

          cb = noop;
        };
      },
      [state]
    ),
    () =>
      mapper(state.get(), isLoadedState._value, errorState && errorState.get())
  );
}) as {
  /**
   * Hook to {@link mapper map} and retrieve a value from a {@link state}.
   * @param mapper - Function that maps the value.
   * @param isEqual - Optional comparison function to determine equality of the mapped values.
   */
  <T, V, E = any>(
    state: AsyncState<T, E>,
    mapper: (value: T | undefined, isLoaded: boolean, error: E | undefined) => V
  ): V;
  /**
   * Hook to {@link mapper map} and retrieve a value from a {@link state}.
   * @param mapper - Function that maps the value.
   * @param isEqual - Optional comparison function to determine equality of the mapped values.
   */
  <T, V>(state: State<T>, mapper: (value: T) => V): V;
};

export default useMappedValue;
