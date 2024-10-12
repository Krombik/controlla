import { postBatchCallbacks, scheduleBatch } from '../utils/batching';

const batchedUpdates = (callback: () => void) => {
  postBatchCallbacks.push(callback);

  scheduleBatch();
};

export default batchedUpdates;
