import { useLayoutEffect } from 'react';
import type { AnyAsyncState, Falsy, HandlePending, State } from '../types';
import onValueChange from '../onValueChange';
import useNoop from '../utils/useNoop';
import getValue from '../getValue';
import useForceRerender from 'react-helpful-utils/useForceRerender';
import handleUnlisteners from '../utils/handleUnlisteners';

const useValue = ((state: AnyAsyncState | Falsy) => {
  if (state) {
    const forceRerender = useForceRerender();

    useLayoutEffect(
      () =>
        handleUnlisteners(
          onValueChange(state, forceRerender),
          'load' in state && !state._withoutLoading && state.load()
        ),
      [state._internal, state._path && state._path.join('.')]
    );

    return getValue(state);
  }

  useNoop();
}) as {
  /** Hook to retrieve the current value from the {@link state}. */
  <S extends State | Falsy>(
    state: S
  ): S extends State<infer T> ? HandlePending<T> : undefined;
};

export default useValue;
