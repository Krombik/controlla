import createAsyncNestedState from '../createAsyncNestedState';
import type { LoadableNestedState, RequestableStateOptions } from '../types';
import getRequestableStateCreator from '../utils/getRequestableStateCreator';

const createRequestableNestedState = getRequestableStateCreator(
  createAsyncNestedState
) as {
  <T, E = any>(
    options: RequestableStateOptions<T, E>
  ): LoadableNestedState<T, E>;
};

export default createRequestableNestedState;
