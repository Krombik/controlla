import createAsyncState from '../createAsyncState';
import type {
  LoadableState,
  OriginalStateCreator,
  RequestableStateOptions,
  StateType,
} from '../types';
import getRequestableStateCreator from '../utils/getRequestableStateCreator';

const createRequestableState = getRequestableStateCreator(createAsyncState);

export default createRequestableState as OriginalStateCreator<
  {
    <T, E = any>(options: RequestableStateOptions<T, E>): LoadableState<T, E>;
  },
  StateType.REQUESTABLE_STATE
>;
