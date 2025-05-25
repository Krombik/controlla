import { useSyncExternalStore } from 'react';
import type { AnyAsyncState, AsyncState, Falsy, ReadonlyState } from '../types';
import noop from 'lodash.noop';
import alwaysNoop from '../utils/alwaysNoop';
import { ROOT } from '../utils/constants';

const useValue = ((state: AnyAsyncState | Falsy) => {
  if (state) {
    const utils = state[ROOT];

    useSyncExternalStore(
      utils._subscribeWithLoad || utils._onValueChange,
      () => utils._valueToggler
    );

    return utils._get();
  }

  useSyncExternalStore(alwaysNoop, noop);
}) as {
  /**
   * A hook to retrieve the current value from the provided {@link state}.
   * It ensures that the component re-renders whenever the {@link state} value changes.
   * If the provided {@link state} is falsy, the hook returns `undefined` and performs no operations.
   */
  <S extends ReadonlyState | Falsy>(
    state: S
  ): S extends ReadonlyState<infer K>
    ? K | (S extends AsyncState ? undefined : never)
    : never;
};

export default useValue;
