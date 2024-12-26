import type {
  StateInitializer,
  StateScope,
  StateCallbackMap,
  State,
  Mutable,
} from '../types';
import handleState from '../utils/handleState';
import createScope from '../utils/createScope';
import { _onValueChange, set } from '../utils/state/scope';
import { get } from '../utils/state/common';

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
  const state = handleState<State, StateCallbackMap>(
    {
      _value: undefined,
      _root: undefined!,
      get,
      _setData: { _root: null, _children: null },
      set,
      _onValueChange,
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
