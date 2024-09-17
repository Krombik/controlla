import type { Pending, State } from '../types';
import { RootKey } from '../utils/constants';

const getValue = <Value>(
  state: State<Value>
): [Extract<Value, Pending>] extends [never]
  ? Value
  : Exclude<Value, Pending> | undefined => {
  const utils = state._internal;

  return utils._get(utils._data.get(RootKey.VALUE), state._path!);
};

export default getValue;
