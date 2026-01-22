import { addBeforeFlushHook, scheduleFlush } from '#utils/batching';

/** Batches updates from external state changes to synchronize them with the library’s control updates. */
const batchedUpdates = (callback: () => void) => {
  addBeforeFlushHook(callback);

  scheduleFlush();
};

export default batchedUpdates;
