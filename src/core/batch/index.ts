import type { Scheduler } from '#types';
import {
  getCurrentLane,
  getSchedulerLane,
  scheduleFlush,
} from '#internal/flushQueue';

/**
 * Runs the {@link callback} right before the next flush, so all control
 * updates made inside it are committed together in a single flush.
 *
 * If the target lane is already flushing (with no {@link scheduler} — any
 * running flush), the callback is executed immediately and its updates join
 * that flush.
 */
const batch = (callback: () => void, scheduler?: Scheduler) => {
  const lane = getSchedulerLane(scheduler);

  if (getCurrentLane() === lane) {
    callback();
  } else {
    lane._beforeFlushHooks.push(callback);

    scheduleFlush(lane);
  }
};

export default batch;
