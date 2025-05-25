import type { AsyncState, ReadonlyState } from '../types';
import { ROOT } from '../utils/constants';

const getValue = <S extends ReadonlyState>(
  state: S
): S extends ReadonlyState<infer K>
  ? K | (S extends AsyncState ? undefined : never)
  : never => state[ROOT]._get();

export default getValue;
