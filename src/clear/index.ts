import type { AsyncState } from '../types';

/** Clears the given {@link state}, clearing its value, {@link AsyncState.error error}, and {@link AsyncState.isLoaded loaded status}. */
const clear = (state: AsyncState) => {
  state.set(undefined, false);
};

export default clear;
