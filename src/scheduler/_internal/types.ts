import type { Scheduler } from '#types';

export type FlushableScheduler = Scheduler & {
  /**
   * Commits the pending updates now.
   *
   * @returns `true` if there was a pending flush, `false` otherwise.
   */
  flush(): boolean;
};
