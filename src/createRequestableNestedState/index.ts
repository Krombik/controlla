import createAsyncNestedState from '../createAsyncNestedState';
import type {
  LoadableNestedState,
  OriginalStateCreator,
  RequestableStateOptions,
  StateType,
} from '../types';
import getRequestableStateCreator from '../utils/getRequestableStateCreator';

const createRequestableNestedState = getRequestableStateCreator(
  createAsyncNestedState
);

export default createRequestableNestedState as OriginalStateCreator<
  {
    <T, E = any>(
      options: RequestableStateOptions<T, E>
    ): LoadableNestedState<T, E>;
  },
  StateType.NESTED_REQUESTABLE_STATE
>;
