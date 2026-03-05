import type { AsyncControl, Scheduler } from '#types';
import { INTERNALS } from '#shared-internal/constants';
import scheduleMicrotask from '#internal/scheduleMicrotask';

/** Clears the given {@link control}, clearing its value, {@link AsyncControl.error error}, and {@link AsyncControl.isLoaded loaded status}. */
const invalidate = (
  control: AsyncControl,
  scheduler: Scheduler = scheduleMicrotask
) => {
  const root = control[INTERNALS]._root;

  root._enqueueSet(undefined, scheduler);

  root._errorControl[INTERNALS]._enqueueSet(undefined, scheduler);
};

export default invalidate;
