import type { ValueChangeCallbacks, InternalControl } from '#_types';
import { ROOT } from '#shared/constants';
import createSubscribe from '#utils/createSubscribe';
import handleControl from '#utils/handleControl';
import { get, set } from '#utils/control/common';
import type { Control, SyncExternalStorage } from '#types';

/**
 * Creates a {@link Control control} for managing simple control value.
 */
const createControl = ((
  value?: unknown | (() => unknown),
  syncExternalStorage?: SyncExternalStorage,
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
        _unobserve: undefined,
      },
      value,
      syncExternalStorage,
      keys
    ),
  };
}) as {
  <T>(): Control<T | undefined>;
  <T>(
    value: T | (() => T),
    syncExternalStorage?: SyncExternalStorage<T | undefined>
  ): Control<T>;
};

export default createControl;
