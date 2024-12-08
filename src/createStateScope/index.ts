import type {
  StateInitializer,
  StateScope,
  StateCallbackMap,
  State,
} from '../types';
import { EMPTY_ARR } from '../utils/constants';
import handleState from '../utils/handleState';
import createScope from '../utils/createScope';
import { _onValueChange, get, set } from '../utils/state/scope';

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
) =>
  createScope(
    handleState<State, StateCallbackMap>(
      {
        _internal: { _value: undefined },
        get,
        _setData: { _root: null, _children: null },
        set,
        _onValueChange,
        _path: EMPTY_ARR,
      },
      value,
      stateInitializer,
      keys
    )
  );

export type { StateScope };

export default createStateScope;
