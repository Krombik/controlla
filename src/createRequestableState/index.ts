import createAsyncState from '../createAsyncState';
import { LoadableAsyncState, RequestableStateOptions } from '../types';
import getRequestableStateCreator from '../utils/getRequestableStateCreator';

const createRequestableState = getRequestableStateCreator(createAsyncState) as {
  <T, E = any>(
    options: RequestableStateOptions<T, E>
  ): LoadableAsyncState<T, E>;
};

export default createRequestableState;
