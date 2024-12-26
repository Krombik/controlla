import type { AnyAsyncState } from '../types';
import handleUnlisteners from './handleUnlisteners';
import onValueChange from '../onValueChange';
import { useLayoutEffect } from 'react';

const useHandleSuspenseValue = (
  state: AnyAsyncState,
  forceRerender: () => void
) => {
  const withValueWatching = !state._awaitOnly;

  useLayoutEffect(() => {
    if (withValueWatching) {
      return handleUnlisteners(
        onValueChange([state, state.error], forceRerender),
        state
      );
    }

    let isPreviousExist = state._root._value !== undefined;

    let isError = false;

    return handleUnlisteners(
      onValueChange([state._root, state.error], ([value, error]) => {
        if (error === undefined) {
          isError = false;

          const isCurrentExist = value !== undefined;

          if (isPreviousExist != isCurrentExist) {
            isPreviousExist = isCurrentExist;

            forceRerender();
          }
        } else if (!isError) {
          isError = true;

          forceRerender();
        }
      }),
      state
    );
  }, [state]);

  if (withValueWatching) {
    return state.get();
  }
};

export default useHandleSuspenseValue;
