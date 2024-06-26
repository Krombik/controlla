import { AnyAsyncState, RootKey } from '../types';
import createGetValueOf from '../utils/createGetValueOf';

const isLoaded = createGetValueOf(RootKey.IS_LOADED) as {
  (state: AnyAsyncState): boolean;
};

export default isLoaded;
