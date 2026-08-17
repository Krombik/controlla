import { getSchedulerLane, scheduleFlush } from '#internal/flushQueue';
import type { PrimitiveControlInternals } from '#internal/types';
import type { Scheduler } from '#types';

const scheduleSet = (
  internals: Pick<PrimitiveControlInternals, '_enqueueSet'>,
  value: any,
  fromSource: boolean,
  scheduler?: Scheduler
) => {
  const lane = getSchedulerLane(scheduler);

  internals._enqueueSet(value, lane, fromSource);

  scheduleFlush(lane);
};

export default scheduleSet;
