import getValue from '../getValue';
import { AnyAsyncState } from '../types';
import handleUnlisteners from './handleUnlisteners';
import onValueChange from '../onValueChange';
import { useLayoutEffect } from 'react';
import toDeps from '../toDeps';

const useHandleSuspenseValue = (
  state: AnyAsyncState,
  forceRerender: () => void
) => {
  const withValueWatching = !state._awaitOnly;

  useLayoutEffect(
    () =>
      handleUnlisteners(
        onValueChange(
          [state, state.error],
          withValueWatching
            ? forceRerender
            : (value) => {
                if (value === undefined) {
                  forceRerender();
                }
              }
        ),
        state
      ),
    toDeps(state)
  );

  if (withValueWatching) {
    return getValue(state);
  }
};

export default useHandleSuspenseValue;
