import type {
  ControlInitializer,
  Control,
  ValueChangeCallbacks,
  InternalControl,
} from '../types';
import { ROOT } from '../utils/constants';
import createSubscribe from '../utils/createSubscribe';
import handleControl from '../utils/handleControl';
import { get, set } from '../utils/control/common';

/**
 * Creates a {@link Control control} for managing simple control value.
 */
const createControl = ((
  value?: unknown | (() => unknown),
  controlInitializer?: ControlInitializer,
  keys?: any[]
) => {
  const callbacks: ValueChangeCallbacks = new Set();

  return {
    [ROOT]: handleControl<InternalControl>(
      {
        _value: undefined,
        _get: get,
        _callbacks: callbacks,
        _set: set,
        _subscribe: createSubscribe(callbacks),
        _valueToggler: 0,
      },
      value,
      controlInitializer,
      keys
    ),
  };
}) as {
  <T>(): Control<T | undefined>;
  <T>(
    value: T | (() => T),
    controlInitializer?: ControlInitializer<T | undefined>
  ): Control<T>;
};

export type { Control };

export default createControl;
