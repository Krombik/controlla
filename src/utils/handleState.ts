import noop from 'lodash.noop';
import type { StateInitializer, StateInternalUtils } from '../types';
import { EMPTY_ARR } from './constants';

const finalizationRegistry: Pick<
  FinalizationRegistry<() => void>,
  'register'
> = typeof FinalizationRegistry != 'undefined'
  ? new FinalizationRegistry((cb) => {
      cb();
    })
  : { register: noop };

const handleState = <T extends StateInternalUtils>(
  value: unknown | (() => unknown) | undefined,
  stateInitializer: StateInitializer | undefined,
  keys: any[] | undefined,
  utils: T
): Readonly<{}> | undefined => {
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

    if (observe) {
      const anchor = {};

      let callable = true;

      utils._onValueChange((value) => {
        if (callable) {
          set(value);
        }
      }, EMPTY_ARR);

      finalizationRegistry.register(
        anchor,
        observe((newValue) => {
          callable = false;

          if (newValue === undefined) {
            newValue =
              typeof originalValue === 'function'
                ? keys
                  ? originalValue(...keys)
                  : originalValue()
                : originalValue;
          }

          utils._set(newValue, EMPTY_ARR, false);

          callable = true;
        })
      );

      utils._value = value;

      return anchor;
    }

    utils._onValueChange(set, EMPTY_ARR);
  } else if (typeof value == 'function') {
    value = keys ? value(...keys) : value();
  }

  utils._value = value;
};

export default handleState;
