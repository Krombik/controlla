import { AnyAsyncState } from '../types';
import deleteError from '../utils/deleteError';
import deleteValue from '../utils/deleteValue';

const clear = <S extends AnyAsyncState>(state: S) => {
  deleteValue(state.r, false);

  deleteError(state.r);

  return state;
};

export default clear;
