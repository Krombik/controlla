import type { AsyncControl, Control, Scheduler } from '#types';
import { INTERNALS } from '#internal/constants';
import { getSchedulerLane, scheduleFlush } from '#internal/flushQueue';
import replacing from '#internal/replacing';

/**
 * Sets the {@link value} of the given {@link control} exactly like
 * `setValue`, but marks the write as a replacement — consumers of the flag
 * treat it accordingly (the router replaces the history entry instead of
 * pushing one, and only if every write in the flush was a replacement).
 * For ordinary controls it's equivalent to `setValue`.
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
