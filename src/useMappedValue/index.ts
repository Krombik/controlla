import { useCallback, useSyncExternalStore } from 'react';
import type { AnyAsyncState, AsyncState, ReadonlyState } from '../types';
import { ROOT } from '../utils/constants';
import { postBatchCallbacksPush } from '../utils/batching';
import noop from 'lodash.noop';

const useMappedValue = ((
  state: AnyAsyncState,
  mapper: (value: any, isLoaded?: boolean, error?: any) => any
) => {
  const utils = state[ROOT];

  const l = mapper.length;

  if (l < 2) {
    return useSyncExternalStore(
      utils._subscribeWithLoad || utils._onValueChange,
      () => mapper(utils._get())
    );
  }

  const root = utils[ROOT];

  const isLoadedState = root._isLoadedState[ROOT];

  const errorState = l > 2 && root._errorState[ROOT];

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
          utils._subscribeWithLoad || utils._onValueChange
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
      [utils]
    ),
    () =>
      mapper(
        utils._get(),
        isLoadedState._value,
        errorState && errorState._value
      )
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
  <T, V>(state: ReadonlyState<T>, mapper: (value: T) => V): V;
};

export default useMappedValue;
