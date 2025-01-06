import { useSyncExternalStore } from 'react';
import type {
  AnyAsyncState,
  AsyncState,
  Falsy,
  StateBase as State,
} from '../types';
import noop from 'lodash.noop';
import alwaysNoop from '../utils/alwaysNoop';

const useValue = ((state: AnyAsyncState | Falsy) => {
  if (state) {
    useSyncExternalStore(
      state._subscribeWithLoad || state._onValueChange,
      () => state._valueToggler
    );

    return state.get();
  }

  useSyncExternalStore(alwaysNoop, noop);
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
