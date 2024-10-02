import getValue from '../getValue';
import type { HandlePending, State, ResolvedValue } from '../types';

const setValue = <S extends State<any>>(
  state: S,
  value: S extends State<infer Value>
    ?
        | ResolvedValue<Value>
        | ((prevValue: HandlePending<Value>) => ResolvedValue<Value>)
    : never
): S => {
  state._internal._set(
    typeof value != 'function' ? value : value(getValue(state)),
    true,
    state._path!,
    false
  );

  return state;
};

export default setValue;
