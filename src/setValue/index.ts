import getValue from '../getValue';
import type { HandlePending, ResolvedValue, State } from '../types';

const setValue = <Value>(
  state: State<Value>,
  value:
    | ResolvedValue<Value>
    | ((prevValue: HandlePending<Value>) => ResolvedValue<Value>)
) => {
  state._internal._set(
    typeof value != 'function' ? value : (value as Function)(getValue(state)),
    state._path!,
    false
  );
};

export default setValue;
