import type { ValueChangeCallbacks } from '#_types';
import { ROOT } from '#shared/constants';
import createSubscribe from '#utils/createSubscribe';
import { get, set } from '#utils/control/common';
import type { Control } from '#types';

/** @internal */
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

/** @internal */
export default createSimpleControl;
