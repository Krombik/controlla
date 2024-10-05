import type { HandlePending, State } from '../types';

const getValue = <Value>(state: State<Value>): HandlePending<Value> =>
  state._internal._get(state._path!);

export default getValue;
