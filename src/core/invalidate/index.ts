import type { AsyncControl, Scheduler } from '#types';
import { RELOAD, SILENT_RELOAD, INTERNALS } from '#internal/constants';
import scheduleSet from '#internal/scheduleSet';
import toPromise from '#core/toPromise';

const invalidate: {
  /**
   * Resets the given async {@link control} — clears its value, error and
   * ready status — and triggers a reload if the control is in use, unless one
   * is already running, which it is left to. Pass
   * {@link silent} as `true` to keep the current value while reloading
   * (stale-while-revalidate).
   *
   * Returns a promise of the value the reload brings in, rejected with its
   * error if it fails. Like `toPromise`, it does not start the loading itself:
   * over a control nothing is using, it stays pending until something does.
   *
   * @example
   * ```ts
   * await api.save(values);
   *
   * const fresh = await invalidate($product, true);
   * ```
   */
  <T>(control: AsyncControl<T>, silent?: boolean): Promise<T>;
  /** Resets the given async {@link control} using a custom {@link scheduler} to batch the flush. */
  <T>(control: AsyncControl<T>, scheduler?: Scheduler): Promise<T>;
} = (control: AsyncControl, schedulerOrKeepPrevValue?: Scheduler | boolean) => {
  const isLoud = schedulerOrKeepPrevValue !== true;

  scheduleSet(
    control[INTERNALS]._root._errorControl[INTERNALS],
    isLoud ? RELOAD : SILENT_RELOAD,
    false,
    isLoud ? schedulerOrKeepPrevValue || undefined : undefined
  );

  // the enqueue armed it, so this is the reload's own answer rather than the
  // value still sitting there until the flush
  return toPromise(control);
};

export default invalidate;
