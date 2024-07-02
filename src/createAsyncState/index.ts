import createState from '../createState';
import type {
  AsyncState,
  AsyncStateOptions,
  LoadableAsyncState,
  LoadableAsyncStateOptions,
  PausableLoadableAsyncState,
  PausableLoadableAsyncStateOptions,
} from '../types';
import getAsyncStateCreator from '../utils/getAsyncStateCreator';

const createAsyncState = getAsyncStateCreator(createState) as {
  <T, E = any>(options?: AsyncStateOptions<T>): AsyncState<T, E>;
  <T, E = any>(
    options: PausableLoadableAsyncStateOptions<T, E>
  ): PausableLoadableAsyncState<T, E>;
  <T, E = any>(
    options: LoadableAsyncStateOptions<T, E>
  ): LoadableAsyncState<T, E>;
};

export default createAsyncState;
