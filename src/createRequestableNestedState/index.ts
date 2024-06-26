import createAsyncNestedState from '../createAsyncNestedState';
import { LoadableAsyncNestedState, RequestableStateOptions } from '../types';
import getRequestableStateCreator from '../utils/getRequestableStateCreator';

const createRequestableNestedState = getRequestableStateCreator(
  createAsyncNestedState
) as {
  <T, E = any>(
    options: RequestableStateOptions<T, E>
  ): LoadableAsyncNestedState<T, E>;
};

export default createRequestableNestedState;
