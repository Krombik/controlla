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
  /**
   * Creates a {@link LoadableNestedState loadable nested state} that supports asynchronous data loading on request.
   * The created state manages loading and error handling for data requests, providing
   * a flexible way to manage request-based state updates.
   */
  <T, E = any>(
    options: RequestableStateOptions<T, E>,
    stateInitializer?: StateInitializer<T>
  ): LoadableNestedState<T, E>;
};

export default createRequestableNestedState;
