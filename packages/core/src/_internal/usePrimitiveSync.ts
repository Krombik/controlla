import type { useSyncExternalStore as _useSyncExternalStore } from 'react';
import type { ReadonlyPrimitiveControlInternals } from './types';

function usePrimitiveSync(
  this: ReadonlyPrimitiveControlInternals,
  useSyncExternalStore: typeof _useSyncExternalStore
) {
  const self = this;

  return useSyncExternalStore(self._subscribe, () => self._value);
}

export default usePrimitiveSync;
