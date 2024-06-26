import { AnyAsyncState, RootKey } from '../types';
import createOnValueOfChange from '../utils/createOnValueOfChange';

const onError = createOnValueOfChange(RootKey.ERROR_CALLBACK_SET) as {
  <E>(state: AnyAsyncState<any, E>, cb: (error: E) => void): () => void;
};

export default onError;
