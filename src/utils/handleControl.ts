import noop from 'lodash.noop';
import type {
  InternalAsyncControl,
  InternalControl,
  ControlInitializer,
} from '../types';
import { postBatchCallbacksPush, scheduleBatch } from './batching';

const finalizationRegistry: Pick<
  FinalizationRegistry<() => void>,
  'register'
> = typeof FinalizationRegistry != 'undefined'
  ? new FinalizationRegistry((cb) => {
      cb();
    })
  : { register: noop };

const _WeakRef =
  typeof WeakRef != 'undefined'
    ? WeakRef
    : (class WeakRef {
        _item: any;

        constructor(item: any) {
          this._item = item;
        }

        deref() {
          return this._item;
        }
      } as typeof WeakRef);

const handleControl = <S extends InternalControl | InternalAsyncControl>(
  control: S,
  value: unknown | (() => unknown) | undefined,
  controlInitializer: ControlInitializer | undefined,
  keys: any[] | undefined
): S => {
  if (controlInitializer) {
    const { get, set, observe } = controlInitializer(keys);

    const _value = get();

    const originalValue = value;

    if (_value !== undefined) {
      value = _value;
    } else {
      if (typeof value == 'function') {
        value = value(keys);
      }

      set(value);
    }

    control._value = value;

    if (observe) {
      let storageValue: any;

      let isSafe = true;

      control._subscribe((value) => {
        if (isSafe || value !== storageValue) {
          set(value);
        }
      });

      const controlRef = new _WeakRef(control);

      finalizationRegistry.register(
        control,
        observe((newValue) => {
          const control = controlRef.deref();

          if (control) {
            if (newValue === undefined) {
              newValue =
                typeof originalValue == 'function'
                  ? originalValue(keys)
                  : originalValue;
            }

            isSafe = false;

            storageValue = newValue;

            postBatchCallbacksPush(() => {
              isSafe = true;

              storageValue = undefined;
            });

            scheduleBatch();

            control._set(newValue);
          }
        })
      );
    } else {
      control._subscribe(set);
    }

    return control as any;
  }

  control._value = typeof value == 'function' ? value(keys) : value;

  return control as any;
};

export default handleControl;
