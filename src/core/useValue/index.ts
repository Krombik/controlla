import { useLayoutEffect, useReducer } from 'react';
import type { Falsy } from '#internal/types';
import noop from 'lodash.noop';
import { INTERNALS } from '#internal/constants';
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
   * Returns the current value of the given {@link control}, rerendering the
   * component whenever it changes. For an async control the value is
   * `undefined` until ready; using the hook starts the loading. The
   * {@link control} may be falsy — the hook returns `undefined`.
   *
   * @example
   * ```tsx
   * const user = useValue($user);
   * ```
   */
  <S extends ReadonlyControl | Falsy>(
    control: S
  ): S extends ReadonlyControl<infer K>
    ? K | (S extends ReadonlyAsyncControl ? undefined : never)
    : never;
};

export default useValue;
