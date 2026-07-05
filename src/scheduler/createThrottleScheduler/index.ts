import type { FlushableScheduler } from '../_internal/types';

export type ThrottleScheduler = FlushableScheduler;

/**
 * Creates a {@link Scheduler} that delays the flush by {@link ms}, batching all
 * updates within that window into one commit — rate-limits rapid updates.
 * {@link ThrottleScheduler.flush flush} forces the pending commit immediately.
 *
 * @example
 * ```ts
 * const scheduler = createThrottleScheduler(100);
 *
 * window.addEventListener('pointermove', (e) => {
 *   setValue($cursor, { x: e.clientX, y: e.clientY }, scheduler); // ≤1 commit per 100ms
 * });
 * ```
 */
const createThrottleScheduler = (ms: number): ThrottleScheduler => {
  let pending: (() => void) | void;

  let timer: ReturnType<typeof setTimeout> | void;

  const scheduler = ((cb) => {
    pending = cb;

    // the flush queue calls this once per cycle, so no timer exists yet
    timer = setTimeout(() => {
      timer = pending = pending!();
    }, ms);
  }) as ThrottleScheduler;

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

export default createThrottleScheduler;
