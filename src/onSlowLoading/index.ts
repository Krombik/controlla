import { AnyLoadableAsyncState, RootKey } from '../types';
import createOnValueOfChange from '../utils/createOnValueOfChange';

const onSlowLoading = createOnValueOfChange(
  RootKey.SLOW_LOADING_CALLBACK_SET
) as {
  (state: AnyLoadableAsyncState, cb: () => void): () => void;
};

export default onSlowLoading;
