import { State, ValueChangeCallbacks } from '../types';
import createSubscribe from './createSubscribe';
import { get, set } from './state/common';

const createSimpleState = <T>(value: T) => {
  const callbacks: ValueChangeCallbacks = new Set();

  return {
    _value: value,
    get,
    _callbacks: callbacks,
    set,
    _onValueChange: createSubscribe(callbacks),
  } as State<T>;
};

export default createSimpleState;
