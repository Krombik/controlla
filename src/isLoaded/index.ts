import type { AnyAsyncState } from '../types';
import { RootKey } from '../utils/constants';
import createGetValueOf from '../utils/createGetValueOf';

const isLoaded = createGetValueOf(RootKey.IS_LOADED) as {
  (state: AnyAsyncState): boolean;
};

export default isLoaded;
