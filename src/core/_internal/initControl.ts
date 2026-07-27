import type {
  AsyncControlInternals,
  Mutable,
  PrimitiveControlInternals,
} from '#internal/types';
import type { SyncExternalStorage } from '#types';
import { getSchedulerLane, scheduleFlush } from '#internal/flushQueue';
import { INTERNALS, RELOAD } from '#internal/constants';
import reportError from '#internal/reportError';

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

    let storageValue;

    try {
      storageValue = externalStorage.get();
    } catch (err) {
      reportError(err);

      internals._value = resolvedInitial;

      return internals;
    }

    if (externalStorage.observe) {
      const ref = new WeakRef(internals);

      const unobserve = (internals._unobserve = externalStorage.observe(
        (value) => {
          const self = ref.deref();

          if (self) {
            const lane = getSchedulerLane();

            if (isSync || value !== undefined) {
              // sync storage was cleared externally - fall back to the initial
              // value, leaving the storage empty so tabs don't race to reseed it
              if (
                isSync &&
                value === undefined &&
                resolvedInitial !== undefined
              ) {
                value = resolvedInitial;
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

    const setExternal = (value: any) => {
      try {
        externalStorage.set(value);
      } catch (err) {
        reportError(err);
      }
    };

    if (storageValue !== undefined) {
      internals._value = storageValue;
    } else {
      if (resolvedInitial !== undefined) {
        setExternal(resolvedInitial);

        internals._value = resolvedInitial;
      }
    }

    // keep the storage as the receiver — `set` may be a method
    (internals as Mutable<I>)._setExternal = setExternal;
  } else {
    internals._value = resolvedInitial;
  }

  return internals;
};

export default initControl;
