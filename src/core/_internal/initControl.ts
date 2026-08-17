import type {
  AsyncControlInternals,
  Mutable,
  PrimitiveControlInternals,
} from '#internal/types';
import type { SyncExternalStorage } from '#types';
import { getSchedulerLane, scheduleFlush } from '#internal/flushQueue';
import { INTERNALS, RELOAD } from '#internal/constants';
import reportError from '#internal/reportError';
import { registerCleanup } from '#internal/cleanup';
import Ref from '#internal/Ref';

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
      const ref = new Ref(internals);

      // the scope may release it before it is collected, and the finalizer
      // still runs afterwards - the storage must be unobserved exactly once
      let unobserve: (() => void) | undefined = externalStorage.observe(
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

              self._enqueueSet(value, lane, true);
            } else {
              (self as any as AsyncControlInternals)._errorControl[
                INTERNALS
              ]._enqueueSet(RELOAD, lane, true);
            }

            scheduleFlush(lane);
          }
        }
      );

      registerCleanup(internals, () => {
        if (unobserve) {
          unobserve();

          unobserve = undefined;
        }
      });
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
