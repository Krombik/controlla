import type { Scheduler } from '#types';

/**
 * A {@link Scheduler} that flushes immediately — updates commit synchronously
 * at the call site; inside a running flush they join it instead of nesting a
 * new one.
 *
 * @example
 * ```ts
 * setValue($counter, 5, syncScheduler);
 * // $counter is already committed here
 * ```
 */
const syncScheduler: Scheduler = (cb) => {
  cb();
};

syncScheduler._sync = true;

export default syncScheduler;
