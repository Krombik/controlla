import { addAfterFlushHook, scheduleFlush } from '#utils/batching';

const batchedPostUpdates = (callback: () => void) => {
  addAfterFlushHook(callback);

  scheduleFlush();
};

export default batchedPostUpdates;
