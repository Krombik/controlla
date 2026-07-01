import type { FlushableScheduler } from '../_internal/types';

export type DebounceScheduler = FlushableScheduler;

/**
 * Creates a {@link Scheduler} that delays the flush until {@link ms} of quiet —
 * each update resets the timer, so it commits once updates stop.
 * {@link DebounceScheduler.flush flush} forces the pending commit immediately.
 *
 * @example
 * ```ts
 * const scheduler = createDebounceScheduler(300);
 *
 * setValue($search, value, scheduler);
 * ```
 */
const createDebounceScheduler = (ms: number): DebounceScheduler => {
  let pending: (() => void) | void;

  let timer: ReturnType<typeof setTimeout> | void;

  const scheduler = ((cb) => {
    pending = cb;
  }) as DebounceScheduler;

  scheduler._debounce = () => {
    clearTimeout(timer!);

    timer = setTimeout(() => {
      timer = pending = pending!();
    }, ms);
  };

  scheduler.flush = () => {
    if (pending) {
      clearTimeout(timer!);

      timer = pending = pending();

      return true;
    }

    return false;
  };

  return scheduler;
};

export default createDebounceScheduler;
