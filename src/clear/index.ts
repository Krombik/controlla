import type { AnyAsyncState } from '../types';

import deleteValue from '../utils/deleteValue';

const clear = <S extends AnyAsyncState>(state: S): S => {
  deleteValue(state._internal, false);

  deleteValue(state.error._internal, false);

  return state;
};

export default clear;
