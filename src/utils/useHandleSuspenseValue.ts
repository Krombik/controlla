import getValue from '../getValue';
import { AnyAsyncState } from '../types';
import handleUnlisteners from './handleUnlisteners';
import onValueChange from '../onValueChange';
import { useLayoutEffect } from 'react';

const useHandleSuspenseValue = (
  state: AnyAsyncState,
  forceRerender: () => void
) => {
  const utils = state._internal;

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
        'load' in state && !state._withoutLoading && state.load()
      ),
    [utils, state._path && state._path.join('.')]
  );

  if (withValueWatching) {
    return getValue(state);
  }
};

export default useHandleSuspenseValue;
