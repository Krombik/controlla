import type {
  ControlInitializer,
  ControlScope,
  Mutable,
  ValueChangeCallbacks,
  InternalControl,
} from '../types';
import handleControl from '../utils/handleControl';
import createScope from '../utils/createScope';
import { set } from '../utils/control/scope';
import { get } from '../utils/control/common';
import createSubscribe from '../utils/createSubscribe';
import { ROOT } from '../utils/constants';

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
    controlInitializer?: ControlInitializer<T | undefined>
  ): ControlScope<T>;
} = (
  value?: unknown | (() => unknown),
  controlInitializer?: ControlInitializer,
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
      _valueToggler: 0,
    },
    value,
    controlInitializer,
    keys
  );

  (control as Mutable<typeof control>)[ROOT] = control;

  return createScope(control);
};

export type { ControlScope };

export default createControlScope;
