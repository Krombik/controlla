import type { AsyncState } from '../types';
import { EMPTY_ARR } from '../utils/constants';

/** Clears the given {@link state}, clearing its value, {@link AsyncState.error error}, and {@link AsyncState.isLoaded loaded status}. */
const clear = (state: AsyncState) => {
  (({ ...state, _path: EMPTY_ARR as any }) as AsyncState).set(undefined, false);
};

export default clear;
