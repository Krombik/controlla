import { useLayoutEffect } from 'react';
import type { AnyAsyncState, Falsy, HandlePending, State } from '../types';
import onValueChange from '../onValueChange';
import useNoop from '../utils/useNoop';
import getValue from '../getValue';
import useForceRerender from 'react-helpful-utils/useForceRerender';
import handleUnlisteners from '../utils/handleUnlisteners';
import toDeps from '../toDeps';

const useValue = ((state: AnyAsyncState | Falsy) => {
  if (state) {
    const forceRerender = useForceRerender();

    useLayoutEffect(
      () => handleUnlisteners(onValueChange(state, forceRerender), state),
      toDeps(state)
    );

    return getValue(state);
  }

  useNoop();
}) as {
  /**
   * A hook to retrieve the current value from the provided {@link state}.
   * It ensures that the component re-renders whenever the {@link state} value changes.
   * If the provided {@link state} is falsy, the hook returns `undefined` and performs no operations.
   */
  <S extends State | Falsy>(
    state: S
  ): S extends State<infer T> ? HandlePending<T> : undefined;
};

export default useValue;
