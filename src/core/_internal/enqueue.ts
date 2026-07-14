import { getSchedulerLane, scheduleFlush } from '#internal/flushQueue';
import type { PrimitiveControlInternals } from '#internal/types';
import type { Scheduler } from '#types';

const enqueue = (
  internals: Pick<PrimitiveControlInternals, '_enqueueSet'>,
  value: any,
  scheduler?: Scheduler
) => {
  const lane = getSchedulerLane(scheduler);

  internals._enqueueSet(value, lane);

  scheduleFlush(lane);
};

export default enqueue;
