import createAsyncNestedState from '../createAsyncNestedState';
import type {
  StateInitializer,
  LoadableNestedState,
  RequestableStateOptions,
} from '../types';
import getRequestableStateCreator from '../utils/getRequestableStateCreator';

const createRequestableNestedState = getRequestableStateCreator(
  createAsyncNestedState
) as {
  <T, E = any>(
    options: RequestableStateOptions<T, E>,
    stateInitializer?: StateInitializer<T>
  ): LoadableNestedState<T, E>;
};

export default createRequestableNestedState;
