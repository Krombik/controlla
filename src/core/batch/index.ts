import type { Scheduler } from '#types';
import { getCurrentLane, getLane, scheduleFlush } from '#internal/flushQueue';
import scheduleMicrotask from '#internal/scheduleMicrotask';

/**
 * Runs the {@link callback} right before the next flush, so all control
 * updates made inside it are committed together in a single flush.
 *
 * If called while a flush is already in progress, the callback is executed
 * immediately and its updates join the current flush.
 */
const batch = (
  callback: () => void,
  scheduler: Scheduler = scheduleMicrotask
) => {
  if (getCurrentLane()) {
    callback();
  } else {
    const lane = getLane(scheduler);

    lane._beforeFlushHooks.push(callback);

    scheduleFlush(lane, scheduler);
  }
};

export default batch;
