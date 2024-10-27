import type { HandlePending, State } from '../types';

/** Retrieves the current value of the given {@link state}. */
const getValue = <Value>(state: State<Value>): HandlePending<Value> =>
  state._internal._get(state._path!);

export default getValue;
