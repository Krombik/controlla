import type { RootControlNode } from '#internal/types';
import type { SyncExternalStorage } from '#types';

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
      control._unobserve = observe((newValue) => {
        control._enqueueSet(newValue);
      });
    }

    control._subscribe(set);
  } else if (typeof value == 'function') {
    value = value(keys);
  }

  control._patchNode._value = value;

  control._patchNode._prevValue = value;

  control._value = value;

  return control;
};

export default initControl;
