import { useLayoutEffect } from 'react';
import type {
  AnyAsyncState,
  AsyncState,
  Falsy,
  StateBase as State,
} from '../types';
import onValueChange from '../onValueChange';
import useNoop from '../utils/useNoop';
import useForceRerender from 'react-helpful-utils/useForceRerender';
import handleUnlisteners from '../utils/handleUnlisteners';

const useValue = ((state: AnyAsyncState | Falsy) => {
  if (state) {
    const forceRerender = useForceRerender();

    useLayoutEffect(
      () => handleUnlisteners(onValueChange(state, forceRerender), state),
      [state]
    );

    return state.get();
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
  ): S extends State<infer K>
    ? K | (S extends AsyncState ? undefined : never)
    : never;
};

export default useValue;
