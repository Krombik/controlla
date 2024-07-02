import createNestedState from '../createNestedState';
import type {
  AsyncNestedState,
  AsyncStateOptions,
  LoadableAsyncNestedState,
  LoadableAsyncStateOptions,
  PausableLoadableAsyncNestedState,
  PausableLoadableAsyncStateOptions,
} from '../types';
import getAsyncStateCreator from '../utils/getAsyncStateCreator';

const createAsyncNestedState = getAsyncStateCreator(createNestedState) as {
  <T, E = any>(options?: AsyncStateOptions<T>): AsyncNestedState<T, E>;
  <T, E = any>(
    options: LoadableAsyncStateOptions<T, E>
  ): LoadableAsyncNestedState<T, E>;
  <T, E = any>(
    options: PausableLoadableAsyncStateOptions<T, E>
  ): PausableLoadableAsyncNestedState<T, E>;
};

export default createAsyncNestedState;
