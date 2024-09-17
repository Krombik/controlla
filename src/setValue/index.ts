import getValue from '../getValue';
import type { Pending, State } from '../types';

const setValue = <S extends State<any>>(
  state: S,
  value: S extends State<infer Value>
    ?
        | Exclude<Value, Pending>
        | ((
            prevValue: [Extract<Value, Pending>] extends [never]
              ? Value
              : Exclude<Value, Pending> | undefined
          ) => Exclude<Value, Pending>)
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
