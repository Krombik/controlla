import type { Mutable, ValueChangeCallbacks, InternalControl } from '#_types';
import handleControl from '#utils/handleControl';
import createScope from '#utils/createScope';
import { set } from '#utils/control/scope';
import { get } from '#utils/control/common';
import createSubscribe from '#utils/createSubscribe';
import { ROOT } from '#shared/constants';
import type { ControlScope, SyncExternalStorage } from '#types';

/**
 * Creates a {@link ControlScope control scope} for managing complex control structures.
 *
 * @example
 * ```js
 * const control1Scope = createControlScope();
 *
 * const control2Scope = createControlScope({ name: 'John' });
 *
 * const control3Scope = createControlScope(() => ({ name: 'John' }));
 * ```
 */
const createControlScope: {
  <T>(): ControlScope<T | undefined>;
  <T>(
    value: T | (() => T),
    syncExternalStorage?: SyncExternalStorage<T | undefined>
  ): ControlScope<T>;
} = (
  value?: unknown | (() => unknown),
  syncExternalStorage?: SyncExternalStorage,
  keys?: any[]
) => {
  const callbacks: ValueChangeCallbacks = new Set();

  const control = handleControl<InternalControl>(
    {
      _value: undefined,
      [ROOT]: undefined!,
      _get: get,
      _callbacks: callbacks,
      _set: set,
      _subscribe: createSubscribe(callbacks),
      _children: undefined,
      _valueToggler: true,
      _unobserve: undefined,
    },
    value,
    syncExternalStorage,
    keys
  );

  (control as Mutable<typeof control>)[ROOT] = control;

  return createScope(control);
};

export default createControlScope;
