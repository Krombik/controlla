import type { AnyLoadableAsyncState } from '../types';
import { RootKey } from '../utils/constants';
import createOnValueOfChange from '../utils/createOnValueOfChange';

const onSlowLoading = createOnValueOfChange(
  RootKey.SLOW_LOADING_CALLBACK_SET
) as {
  (state: AnyLoadableAsyncState, cb: () => void): () => void;
};

export default onSlowLoading;
