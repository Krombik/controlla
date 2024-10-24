import { postBatchCallbacksPush, scheduleBatch } from '../utils/batching';

const batchedUpdates = (callback: () => void) => {
  postBatchCallbacksPush(callback);

  scheduleBatch();
};

export default batchedUpdates;
