import type { AsyncControl, Scheduler } from '#types';
import scheduleMicrotask from '#internal/scheduleMicrotask';
import { getLane, scheduleFlush } from '#internal/flushQueue';
import { RELOAD, SILENT_RELOAD, INTERNALS } from '#internal/constants';

const invalidate: {
  /**
   * Resets the given async {@link control} — clears its value, error and
   * ready status — and triggers a reload if the control is in use. Pass
   * {@link silent} as `true` to keep the current value while reloading
   * (stale-while-revalidate).
   */
  (control: AsyncControl, silent?: boolean): void;
  /** Resets the given async {@link control} using a custom {@link scheduler} to batch the flush. */
  (control: AsyncControl, scheduler?: Scheduler): void;
} = (control: AsyncControl, schedulerOrKeepPrevValue?: Scheduler | boolean) => {
  const isLoud = schedulerOrKeepPrevValue !== true;

  const scheduler = (isLoud && schedulerOrKeepPrevValue) || scheduleMicrotask;

  const lane = getLane(scheduler);

  control[INTERNALS]._root._errorControl[INTERNALS]._enqueueSet(
    isLoud ? RELOAD : SILENT_RELOAD,
    lane
  );

  scheduleFlush(lane, scheduler);
};

export default invalidate;
