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

    const root = state._root;

    let isPreviousExist = root._value !== undefined;

    return handleUnlisteners(
      onValueChange([root, state.error], () => {
        const isCurrentExist = root._value !== undefined;

        if (isPreviousExist != isCurrentExist) {
          isPreviousExist = isCurrentExist;

          forceRerender();
        }
      }),
      root
    );
  }, [state]);

  if (withValueWatching) {
    return state.get();
  }
};

export default useHandleSuspenseValue;
