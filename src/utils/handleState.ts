import noop from 'lodash.noop';
import type { AsyncState, SetData, State, StateInitializer } from '../types';
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
  state: S & SetData<D>,
  value: unknown | (() => unknown) | undefined,
  stateInitializer: StateInitializer | undefined,
  keys: any[] | undefined
) => {
  if (stateInitializer) {
    const { get, set, observe } = stateInitializer(keys);

    const _value = get();

    const originalValue = value;

    if (_value !== undefined) {
      value = _value;
    } else {
      if (typeof value == 'function') {
        value = keys ? value(...keys) : value();
      }

      set(value);
    }

    state._internal._value = value;

    if (observe) {
      let callable = true;

      const _state: Pick<State, 'set' | '_internal'> &
        Partial<Pick<AsyncState, '_commonSet'>> = {
        _internal: state._internal,
        set: state.set,
        _commonSet: (state as AsyncState)._commonSet,
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
                ? keys
                  ? originalValue(...keys)
                  : originalValue()
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

    return state;
  }

  state._internal._value =
    typeof value == 'function' ? (keys ? value(...keys) : value()) : value;

  return state;
};

export default handleState;
