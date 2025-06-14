import { useSyncExternalStore } from 'react';
import type {
  AnyAsyncControl,
  Falsy,
  ReadonlyAsyncControl,
  ReadonlyControl,
} from '../types';
import noop from 'lodash.noop';
import alwaysNoop from '../utils/alwaysNoop';
import { ROOT } from '../utils/constants';

const useValue = ((control: AnyAsyncControl | Falsy) => {
  if (control) {
    const utils = control[ROOT];

    useSyncExternalStore(
      utils._subscribeWithLoad || utils._subscribe,
      () => utils._valueToggler
    );

    return utils._get();
  }

  useSyncExternalStore(alwaysNoop, noop);
}) as {
  /**
   * A hook to retrieve the current value from the provided {@link control}.
   * It ensures that the component re-renders whenever the {@link control} value changes.
   * If the provided {@link control} is falsy, the hook returns `undefined` and performs no operations.
   */
  <S extends ReadonlyControl | Falsy>(
    control: S
  ): S extends ReadonlyControl<infer K>
    ? K | (S extends ReadonlyAsyncControl ? undefined : never)
    : never;
};

export default useValue;
