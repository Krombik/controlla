import noop from 'lodash.noop';
import type { AsyncState, State, StateInitializer } from '../types';
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

const handleState = <S extends State | AsyncState>(
  state: Omit<S, symbol>,
  value: unknown | (() => unknown) | undefined,
  stateInitializer: StateInitializer | undefined,
  keys: any[] | undefined
): S => {
  if (stateInitializer) {
    const { get, set, observe } = stateInitializer(keys);

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

    state._value = value;

    if (observe) {
      let storageValue: any;

      let isSafe = true;

      state._onValueChange((value) => {
        if (isSafe || value !== storageValue) {
          set(value);
        }
      });

      const stateRef = new _WeakRef(state);

      finalizationRegistry.register(
        state,
        observe((newValue) => {
          const state = stateRef.deref();

          if (state) {
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

            state.set(newValue);
          }
        })
      );
    } else {
      state._onValueChange(set);
    }

    return state as any;
  }

  state._value = typeof value == 'function' ? value(keys) : value;

  return state as any;
};

export default handleState;
