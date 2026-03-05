import type { RootControlNode } from '#internal/types';
import type { Scheduler } from '#types';
import { getLane, scheduleFlush } from '#internal/flushQueue';
import runPatching from '#internal/runPatching';

const enqueueSet = (
  control: RootControlNode,
  nextValue: any,
  scheduler: Scheduler,
  path?: readonly string[]
) => {
  const lane = getLane(scheduler);

  runPatching(lane, control, nextValue, path);

  scheduleFlush(lane, scheduler);
};

export default enqueueSet;
