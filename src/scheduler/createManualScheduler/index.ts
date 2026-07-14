import type { FlushableScheduler } from '../_internal/types';

export type ManualScheduler = FlushableScheduler;

/**
 * Creates a {@link Scheduler} that commits only when
 * {@link ManualScheduler.flush flush} is called — gather updates and apply them
 * together on demand.
 *
 * @example
 * ```ts
 * const scheduler = createManualScheduler();
 *
 * setValue($filters.minPrice, 10, scheduler);
 * setValue($filters.inStock, true, scheduler);
 *
 * scheduler.flush(); // both commit now
 * ```
 */
const createManualScheduler = (): ManualScheduler => {
  let pending: (() => void) | void;

  const scheduler = ((cb) => {
    pending = cb;
  }) as ManualScheduler;

  // updates made during a flush join it instead of waiting for `flush`
  scheduler._sync = true;

  scheduler.flush = () => {
    if (pending) {
      pending = pending();

      return true;
    }

    return false;
  };

  return scheduler;
};

export default createManualScheduler;
