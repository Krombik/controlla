import { AsyncState } from '../types';
import { EMPTY_ARR } from '../utils/constants';

const clear = (state: AsyncState) => {
  state._internal._set(undefined, EMPTY_ARR, false);
};

export default clear;
