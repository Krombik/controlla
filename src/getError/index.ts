import { AnyAsyncState, RootKey } from '../types';
import createGetValueOf from '../utils/createGetValueOf';

const getError = createGetValueOf(RootKey.ERROR) as {
  <E>(state: AnyAsyncState<any, E>): E;
};

export default getError;
