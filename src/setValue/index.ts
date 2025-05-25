import type { AsyncState, State } from '../types';
import { ROOT } from '../utils/constants';

const setValue = <S extends State>(
  state: S,
  value: S extends State<infer K>
    ? K | ((prevValue: K | (S extends AsyncState ? undefined : never)) => K)
    : never
) => {
  const utils = state[ROOT];

  (utils[ROOT] || utils)._set(
    typeof value != 'function' ? value : value(utils._get()),
    utils._path
  );
};

export default setValue;
