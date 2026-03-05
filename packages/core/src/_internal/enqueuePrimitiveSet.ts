import type { PrimitiveControlInternals } from '#internal/types';
import type { Scheduler } from '#types';
import { getLane, scheduleFlush } from '#internal/flushQueue';

const enqueuePrimitiveSet = (
  control: PrimitiveControlInternals,
  nextValue: any,
  scheduler: Scheduler
) => {
  const lane = getLane(scheduler);

  lane._patchByControl.set(control, nextValue);

  scheduleFlush(lane, scheduler);
};

export default enqueuePrimitiveSet;
