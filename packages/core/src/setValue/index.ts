import type { AsyncControl, Control, Scheduler } from '#types';
import { INTERNALS } from '#shared-internal/constants';
import scheduleMicrotask from '#internal/scheduleMicrotask';
import { getLane, scheduleFlush } from '#internal/flushQueue';

const setValue = <S extends Control>(
  control: S,
  value: S extends Control<infer K>
    ? K | ((prevValue: K | (S extends AsyncControl ? undefined : never)) => K)
    : never,
  scheduler: Scheduler = scheduleMicrotask
) => {
  const internals = control[INTERNALS];

  const lane = getLane(scheduler);

  internals[INTERNALS]._enqueueSet(
    typeof value != 'function' ? value : value(internals._get()),
    lane,
    internals._path
  );

  scheduleFlush(lane, scheduler);
};

export default setValue;
