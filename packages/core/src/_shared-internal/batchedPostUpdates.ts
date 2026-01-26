import { addAfterFlushHook, scheduleFlush } from '#internal/flushQueue';

/** @internal */
const batchedPostUpdates = (callback: () => void) => {
  addAfterFlushHook(callback);

  scheduleFlush();
};

/** @internal */
export default batchedPostUpdates;
