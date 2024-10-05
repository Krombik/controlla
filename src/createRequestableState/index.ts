import createAsyncState from '../createAsyncState';
import type {
  StateInitializer,
  LoadableState,
  RequestableStateOptions,
} from '../types';
import getRequestableStateCreator from '../utils/getRequestableStateCreator';

const createRequestableState = getRequestableStateCreator(createAsyncState) as {
  <T, E = any>(
    options: RequestableStateOptions<T, E>,
    stateInitializer?: StateInitializer<T>
  ): LoadableState<T, E>;
};

export default createRequestableState;
