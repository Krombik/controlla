import type { Mutable, PrimitiveControlInternals } from '#internal/types';
import { INTERNALS } from '#shared-internal/constants';
import type { SyncExternalStorage } from '#types';

const initControl = <I extends PrimitiveControlInternals>(
  internals: I,
  value: unknown | (() => unknown) | undefined,
  syncExternalStorage: SyncExternalStorage | undefined,
  keys: any[] | undefined
): I => {
  (internals as Mutable<I>)[INTERNALS] = internals;

  if (syncExternalStorage) {
    const externalStorage = syncExternalStorage(keys);

    if (externalStorage.observe) {
    }

    const storageValue = externalStorage.get();

    if (storageValue !== undefined) {
      internals._value = storageValue;
    } else {
      const defaultValue = typeof value != 'function' ? value : value();

      if (defaultValue !== undefined) {
        externalStorage.set(defaultValue);

        internals._value = defaultValue;
      }
    }
  } else {
    internals._value = typeof value != 'function' ? value : value();
  }

  return internals;
};

export default initControl;
