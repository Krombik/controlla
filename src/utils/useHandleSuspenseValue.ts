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

    let isPreviousExist = state.get() !== undefined;

    return handleUnlisteners(
      onValueChange([state, state.error], (value) => {
        const isCurrentExist = value !== undefined;

        if (isPreviousExist != isCurrentExist) {
          isPreviousExist = isCurrentExist;

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
