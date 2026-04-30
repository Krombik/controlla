import { useLayoutEffect, useReducer } from 'react';
import type { Falsy } from '#internal/types';
import noop from 'lodash.noop';
import { INTERNALS } from '#shared-internal/constants';
import type {
  AsyncControl,
  ReadonlyAsyncControl,
  ReadonlyControl,
} from '#types';
import forceRerenderReducer from '#internal/forceRerenderReducer';
import useInternalsValue from '#internal/useInternalsValue';

const useValue = ((control: AsyncControl | Falsy) => {
  const forceRerender = useReducer(forceRerenderReducer, 0)[1];

  if (control) {
    return useInternalsValue(control[INTERNALS], forceRerender);
  }

  useLayoutEffect(noop, [0]);
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
