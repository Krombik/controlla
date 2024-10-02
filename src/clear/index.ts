import type { AsyncState } from '../types';

import deleteValue from '../utils/deleteValue';

const clear = <S extends AsyncState>(state: S): S => {
  deleteValue(state._internal, false);

  deleteValue(state.error._internal, false);

  return state;
};

export default clear;
