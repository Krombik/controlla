import createAsyncState from '../createAsyncState';
import type { LoadableState, RequestableStateOptions } from '../types';
import getRequestableStateCreator from '../utils/getRequestableStateCreator';

const createRequestableState = getRequestableStateCreator(createAsyncState) as {
  <T, E = any>(options: RequestableStateOptions<T, E>): LoadableState<T, E>;
};

export default createRequestableState;
