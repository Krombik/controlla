import type { AsyncControl, Scheduler } from '#types';
import { RELOAD, SILENT_RELOAD, INTERNALS } from '#internal/constants';
import scheduleSet from '#internal/scheduleSet';

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

  scheduleSet(
    control[INTERNALS]._root._errorControl[INTERNALS],
    isLoud ? RELOAD : SILENT_RELOAD,
    (isLoud && schedulerOrKeepPrevValue) || undefined
  );
};

export default invalidate;
