import type {
  StateInitializer,
  StateScope,
  State,
  Mutable,
  ValueChangeCallbacks,
} from '../types';
import handleState from '../utils/handleState';
import createScope from '../utils/createScope';
import { set } from '../utils/state/scope';
import { get } from '../utils/state/common';
import createSubscribe from '../utils/createSubscribe';

/**
 * Creates a {@link StateScope state scope} for managing complex state structures.
 *
 * @example
 * ```js
 * const state1Scope = createStateScope();
 *
 * const state2Scope = createStateScope({ name: 'John' });
 *
 * const state3Scope = createStateScope(() => ({ name: 'John' }));
 * ```
 */
const createStateScope: {
  <T>(): StateScope<T | undefined>;
  <T>(
    value: T | (() => T),
    stateInitializer?: StateInitializer<T>
  ): StateScope<T>;
} = (
  value?: unknown | (() => unknown),
  stateInitializer?: StateInitializer,
  keys?: any[]
) => {
  const callbacks: ValueChangeCallbacks = new Set();

  const state = handleState<State>(
    {
      _value: undefined,
      _root: undefined!,
      get,
      _callbacks: callbacks,
      set,
      _onValueChange: createSubscribe(callbacks),
      _children: undefined,
      _valueToggler: 0,
    },
    value,
    stateInitializer,
    keys
  );

  (state as Mutable<typeof state>)._root = state;

  return createScope(state);
};

export type { StateScope };

export default createStateScope;
