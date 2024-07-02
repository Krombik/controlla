import createAsyncState from '../createAsyncState';
import type { LoadableAsyncState, RequestableStateOptions } from '../types';
import getRequestableStateCreator from '../utils/getRequestableStateCreator';

const createRequestableState = getRequestableStateCreator(createAsyncState) as {
  <T, E = any>(
    options: RequestableStateOptions<T, E>
  ): LoadableAsyncState<T, E>;
};

export default createRequestableState;
