import { Control, ValueChangeCallbacks } from '../types';
import { ROOT } from './constants';
import createSubscribe from './createSubscribe';
import { get, set } from './control/common';

const createSimpleControl = <T>(value?: T) => {
  const callbacks: ValueChangeCallbacks = new Set();

  return {
    [ROOT]: {
      _value: value,
      _get: get,
      _callbacks: callbacks,
      _set: set,
      _subscribe: createSubscribe(callbacks),
    },
  } as Control<T>;
};

export default createSimpleControl;
