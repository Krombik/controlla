import createAsyncState from '../createAsyncState';
import type {
  InitModule,
  LoadableState,
  RequestableStateOptions,
} from '../types';
import getRequestableStateCreator from '../utils/getRequestableStateCreator';

const createRequestableState = getRequestableStateCreator(createAsyncState) as {
  <T, E = any>(
    options: RequestableStateOptions<T, E>,
    initModule?: InitModule<T>
  ): LoadableState<T, E>;
};

export default createRequestableState;
