import type { AsyncControl, Scheduler } from '#types';
import { INTERNALS } from '#shared-internal/constants';
import scheduleMicrotask from '#internal/scheduleMicrotask';
import { getLane, scheduleFlush } from '#internal/flushQueue';
import { RELOAD, SILENT_RELOAD } from '#internal/constants';

/** Clears the given {@link control}, clearing its value, {@link AsyncControl.error error}, and {@link AsyncControl.isLoaded loaded status}. */
const invalidate: {
  (control: AsyncControl, silent?: boolean): void;
  (control: AsyncControl, scheduler?: Scheduler): void;
} = (control: AsyncControl, schedulerOrKeepPrevValue?: Scheduler | boolean) => {
  const isLoud = schedulerOrKeepPrevValue !== true;

  const scheduler = isLoud
    ? schedulerOrKeepPrevValue || scheduleMicrotask
    : scheduleMicrotask;

  const lane = getLane(scheduler);

  control[INTERNALS][INTERNALS]._errorControl[INTERNALS]._enqueueSet(
    isLoud ? RELOAD : SILENT_RELOAD,
    lane,
    undefined
  );

  scheduleFlush(lane, scheduler);
};

export default invalidate;
