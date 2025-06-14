import { beforeBatchCallbacksPush, scheduleBatch } from '../utils/batching';

/** Batches updates from external state changes to synchronize them with the library’s control updates. */
const batchedUpdates = (callback: () => void) => {
  beforeBatchCallbacksPush(callback);

  scheduleBatch();
};

export default batchedUpdates;
