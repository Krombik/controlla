import type { RootControlNode } from '#internal/types';
import type { SyncExternalStorage } from '#types';
import scheduleMicrotask from './scheduleMicrotask';

const initControl = <S extends RootControlNode>(
  control: S,
  value: unknown | (() => unknown) | undefined,
  syncExternalStorage: SyncExternalStorage | undefined,
  keys: any[] | undefined
): S => {
  if (syncExternalStorage) {
    const { get, set, observe } = syncExternalStorage(keys);

    const _value = get();

    if (_value !== undefined) {
      value = _value;
    } else {
      if (typeof value == 'function') {
        value = value(keys);
      }

      set(value);
    }

    if (observe) {
      const cleanup = observe((newValue) => {
        control._enqueueSet(newValue, scheduleMicrotask);
      });

      control._useCleanup = (useEffect) => {
        useEffect(() => cleanup, [cleanup]);
      };
    }

    control._subscribe(set, true);
  } else if (typeof value == 'function') {
    value = value(keys);
  }

  control._value = value;

  return control;
};

export default initControl;
