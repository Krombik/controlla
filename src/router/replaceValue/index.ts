import type { AsyncControl, Control, Scheduler } from '#types';
import { INTERNALS } from '#internal/constants';
import { getSchedulerLane, scheduleFlush } from '#internal/flushQueue';
import { replacing } from '#router/internal/state';

/**
 * Writes to a **router params** {@link control} like `setValue`, but replaces
 * the current history entry instead of pushing a new one — and only if every
 * write in the flush was a replacement.
 *
 * Meaningful only for router controls (from `selectParams`); on any other
 * control it behaves exactly like `setValue` — use `setValue` there.
 *
 * @example
 * ```ts
 * replaceValue(selectParams(router.routes.search), { q: 'phones' });
 * ```
 */
const replaceValue = <C extends Control>(
  control: C,
  value: C extends Control<infer K>
    ? K | ((prevValue: K | (C extends AsyncControl ? undefined : never)) => K)
    : never,
  scheduler?: Scheduler
) => {
  const internals = control[INTERNALS];

  const lane = getSchedulerLane(scheduler);

  replacing._value = true;

  try {
    internals._root._enqueueSet(
      typeof value != 'function' ? value : value(internals._get()),
      lane,
      internals._path
    );
  } finally {
    replacing._value = false;
  }

  scheduleFlush(lane);
};

export default replaceValue;
