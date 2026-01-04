import type { AsyncControl } from '#types';
import { ROOT } from '#shared/constants';

/** Clears the given {@link control}, clearing its value, {@link AsyncControl.error error}, and {@link AsyncControl.isLoaded loaded status}. */
const clear = (control: AsyncControl) => {
  control[ROOT][ROOT]._set(undefined);
};

export default clear;
