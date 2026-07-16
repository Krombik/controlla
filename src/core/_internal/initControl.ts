import type {
  AsyncControlInternals,
  Mutable,
  PrimitiveControlInternals,
} from '#internal/types';
import type { SyncExternalStorage } from '#types';
import { getSchedulerLane, scheduleFlush } from '#internal/flushQueue';
import { INTERNALS, RELOAD } from '#internal/constants';

const initControl = <I extends PrimitiveControlInternals>(
  internals: I,
  initialValue: unknown | (() => unknown) | undefined,
  syncExternalStorage: SyncExternalStorage | undefined,
  keys: any[] | undefined,
  isSync: boolean
): I => {
  (internals as Mutable<I>)._root = internals;

  const resolvedInitial =
    typeof initialValue != 'function'
      ? initialValue
      : keys
        ? initialValue(...keys)
        : initialValue();

  if (syncExternalStorage) {
    const externalStorage = syncExternalStorage(keys);

    if (externalStorage.observe) {
      const ref = new WeakRef(internals);

      const unobserve = (internals._unobserve = externalStorage.observe(
        (value) => {
          const self = ref.deref();

          if (self) {
            const lane = getSchedulerLane();

            if (isSync || value !== undefined) {
              if (
                isSync &&
                value === undefined &&
                resolvedInitial !== undefined
              ) {
                value = resolvedInitial;

                externalStorage.set(resolvedInitial);
              }

              self._enqueueSet(value, lane);
            } else {
              (self as any as AsyncControlInternals)._errorControl[
                INTERNALS
              ]._enqueueSet(RELOAD, lane);
            }

            scheduleFlush(lane);
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
      if (resolvedInitial !== undefined) {
        externalStorage.set(resolvedInitial);

        internals._value = resolvedInitial;
      }
    }

    // keep the storage as the receiver — `set` may be a method
    (internals as Mutable<I>)._setExternal = (value) =>
      externalStorage.set(value);
  } else {
    internals._value = resolvedInitial;
  }

  return internals;
};

export default initControl;
