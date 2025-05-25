import type { AsyncState } from '../types';
import { ROOT } from '../utils/constants';

/** Clears the given {@link state}, clearing its value, {@link AsyncState.error error}, and {@link AsyncState.isLoaded loaded status}. */
const clear = (state: AsyncState) => {
  state[ROOT][ROOT]._set(undefined);
};

export default clear;
