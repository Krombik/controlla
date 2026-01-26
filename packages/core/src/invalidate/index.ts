import type { AsyncControl } from '#types';
import { INTERNALS } from '#shared-internal/constants';

/** Clears the given {@link control}, clearing its value, {@link AsyncControl.error error}, and {@link AsyncControl.isLoaded loaded status}. */
const invalidate = (control: AsyncControl) => {
  const root = control[INTERNALS]._root;

  root._enqueueSet(undefined);

  root._errorControl[INTERNALS]._enqueueSet(undefined);
};

export default invalidate;
