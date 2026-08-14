import type { Scheduler } from '#types';

export type FlushableScheduler = Scheduler & {
  /**
   * Commits the pending updates now — or, called while another scheduler is
   * flushing, right after that one, so a commit never lands in the middle of
   * another.
   *
   * @returns `true` if there was a pending flush, `false` otherwise.
   */
  flush(): boolean;
};
