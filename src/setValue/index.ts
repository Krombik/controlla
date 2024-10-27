import getValue from '../getValue';
import type { HandlePending, ResolvedValue, State } from '../types';

/**
 * Sets a new {@link value} to the given {@link state}.
 * @example
 * ```js
 * setValue(state, 5); // Updates the state value to 5
 *
 * setValue(state, (prev) => prev + 1); // Increments the state value by 1
 * ```
 */
const setValue = <V>(
  state: State<V>,
  value: ResolvedValue<V> | ((prevValue: HandlePending<V>) => ResolvedValue<V>)
) => {
  state._internal._set(
    typeof value != 'function' ? value : (value as Function)(getValue(state)),
    state._path!,
    false
  );
};

export default setValue;
