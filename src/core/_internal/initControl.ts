import type {
  AsyncControlInternals,
  Mutable,
  PrimitiveControlInternals,
} from '#internal/types';
import type { SyncExternalStorage } from '#types';
import { getCurrentLane, getLane, scheduleFlush } from '#internal/flushQueue';
import scheduleMicrotask from '#internal/scheduleMicrotask';
import { INTERNALS, RELOAD } from '#internal/constants';

const initControl = <I extends PrimitiveControlInternals>(
  internals: I,
  value: unknown | (() => unknown) | undefined,
  syncExternalStorage: SyncExternalStorage | undefined,
  keys: any[] | undefined,
  isSync: boolean
): I => {
  (internals as Mutable<I>)._root = internals;

  const defaultValue =
    typeof value != 'function' ? value : keys ? value(...keys) : value();

  if (syncExternalStorage) {
    const externalStorage = syncExternalStorage(keys);

    if (externalStorage.observe) {
      const ref = new WeakRef(internals);

      const unobserve = (internals._unobserve = externalStorage.observe(
        (value) => {
          const self = ref.deref();

          if (self) {
            const lane = getCurrentLane() || getLane(scheduleMicrotask);

            if (isSync || value !== undefined) {
              if (isSync && value === undefined && defaultValue !== undefined) {
                value = defaultValue;

                externalStorage.set(defaultValue);
              }

              self._enqueueSet(value, lane);
            } else {
              (self as any as AsyncControlInternals)._errorControl[
                INTERNALS
              ]._enqueueSet(RELOAD, lane);
            }

            scheduleFlush(lane, scheduleMicrotask);
          } else {
            unobserve();
          }
        }
      ));
    }

    const storageValue = externalStorage.get();

    if (storageValue !== undefined) {
      internals._value = storageValue;
    } else {
      if (defaultValue !== undefined) {
        externalStorage.set(defaultValue);

        internals._value = defaultValue;
      }
    }

    (internals as Mutable<I>)._externalStorage = externalStorage;
  } else {
    internals._value = defaultValue;
  }

  return internals;
};

export default initControl;
