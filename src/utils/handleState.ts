import noop from 'lodash.noop';
import type {
  AsyncState,
  InternalSetData,
  State,
  StateInitializer,
} from '../types';
import { postBatchCallbacksPush } from './batching';

const finalizationRegistry: Pick<
  FinalizationRegistry<() => void>,
  'register'
> = typeof FinalizationRegistry != 'undefined'
  ? new FinalizationRegistry((cb) => {
      cb();
    })
  : { register: noop };

const handleState = <S extends State | AsyncState, D = any>(
  state: Omit<S, symbol> & InternalSetData<D>,
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

    state._internal._value = value;

    if (observe) {
      let callable = true;

      const _state = {
        ...state,
      };

      state._onValueChange((value) => {
        if (callable) {
          set(value);
        }
      });

      state._anchor = state;

      finalizationRegistry.register(
        state,
        observe((newValue) => {
          callable = false;

          if (newValue === undefined) {
            newValue =
              typeof originalValue == 'function'
                ? originalValue(keys)
                : originalValue;
          }

          _state.set(newValue, false);

          postBatchCallbacksPush(() => {
            callable = true;
          });
        })
      );
    } else {
      state._onValueChange(set);
    }

    return state as any as S;
  }

  state._internal._value = typeof value == 'function' ? value(keys) : value;

  return state as any as S;
};

export default handleState;
