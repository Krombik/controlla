import { useSyncExternalStore } from 'react';
import type { Falsy } from '#internal/types';
import noop from 'lodash.noop';
import alwaysNoop from '#shared-internal/alwaysNoop';
import { INTERNALS } from '#shared-internal/constants';
import type {
  AsyncControl,
  ReadonlyAsyncControl,
  ReadonlyControl,
} from '#types';

const useValue = ((control: AsyncControl | Falsy) => {
  if (control) {
    const utils = control[INTERNALS];

    useSyncExternalStore(utils._subscribe, () => utils._versionToggle);

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
