import noop from 'lodash.noop';
import type { InitModule, StateDataMap, StateInternalUtils } from '../types';
import { EMPTY_ARR, RootKey } from './constants';

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
  initModule: InitModule | undefined,
  keys: any[] | undefined,
  utils: T
): Readonly<{}> | undefined => {
  const data: StateDataMap = new Map();

  utils._data = data;

  if (initModule) {
    const { get, set, register } = initModule(keys);

    const _value = get();

    if (_value !== undefined) {
      value = _value;
    } else {
      if (typeof value == 'function') {
        value = keys ? value(...keys) : value();
      }

      set(value);
    }

    if (register) {
      const anchor = {};

      let callable = true;

      utils._onValueChange((value) => {
        if (callable) {
          set(value);
        }
      }, EMPTY_ARR);

      finalizationRegistry.register(
        anchor,
        register((value) => {
          callable = false;

          utils._set(value, true, EMPTY_ARR, false);

          callable = true;
        })
      );

      if (value !== undefined) {
        data.set(RootKey.VALUE, value);
      }

      return anchor;
    }

    utils._onValueChange(set, EMPTY_ARR);
  } else if (typeof value == 'function') {
    value = keys ? value(...keys) : value();
  }

  if (value !== undefined) {
    data.set(RootKey.VALUE, value);
  }
};

export default handleState;
