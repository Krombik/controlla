import type { AsyncControl } from '#types';
import { ROOT } from '#shared/constants';

/** Clears the given {@link control}, clearing its value, {@link AsyncControl.error error}, and {@link AsyncControl.isLoaded loaded status}. */
const clear = (control: AsyncControl) => {
  const root = control[ROOT]._root;

  root._enqueueSet(undefined);

  root._errorControl[ROOT]._enqueueSet(undefined);
};

export default clear;
