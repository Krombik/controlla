import { State, ValueChangeCallbacks } from '../types';
import { ROOT } from './constants';
import createSubscribe from './createSubscribe';
import { get, set } from './state/common';

const createSimpleState = <T>(value?: T) => {
  const callbacks: ValueChangeCallbacks = new Set();

  return {
    [ROOT]: {
      _value: value,
      _get: get,
      _callbacks: callbacks,
      _set: set,
      _onValueChange: createSubscribe(callbacks),
    },
  } as State<T>;
};

export default createSimpleState;
