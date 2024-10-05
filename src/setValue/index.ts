import getValue from '../getValue';
import type { HandlePending, State } from '../types';

const setValue = <S extends State<any>>(
  state: S,
  value: S extends State<infer Value>
    ?
        | HandlePending<Value>
        | ((prevValue: HandlePending<Value>) => HandlePending<Value>)
    : never
): S => {
  state._internal._set(
    typeof value != 'function' ? value : value(getValue(state)),
    state._path!,
    false
  );

  return state;
};

export default setValue;
