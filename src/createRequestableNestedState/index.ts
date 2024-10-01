import createAsyncNestedState from '../createAsyncNestedState';
import type {
  InitModule,
  LoadableNestedState,
  RequestableStateOptions,
} from '../types';
import getRequestableStateCreator from '../utils/getRequestableStateCreator';

const createRequestableNestedState = getRequestableStateCreator(
  createAsyncNestedState
) as {
  <T, E = any>(
    options: RequestableStateOptions<T, E>,
    initModule?: InitModule<T>
  ): LoadableNestedState<T, E>;
};

export default createRequestableNestedState;
