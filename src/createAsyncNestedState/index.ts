import createNestedState from '../createNestedState';
import {
  AsyncNestedState,
  AsyncStateOptions,
  LoadableAsyncNestedState,
  LoadableAsyncStateOptions,
  PausableLoadableAsyncNestedState,
  PausableLoadableAsyncStateOptions,
} from '../types';
import getAsyncStateCreator from '../utils/getAsyncStateCreator';

const createAsyncNestedState = getAsyncStateCreator(createNestedState) as {
  (options: {
    [key in keyof PausableLoadableAsyncStateOptions<any>]: never;
  }): never;
  <T>(options?: AsyncStateOptions<T>): AsyncNestedState<T>;
  <T>(options: LoadableAsyncStateOptions<T>): LoadableAsyncNestedState<T>;
  <T>(
    options: PausableLoadableAsyncStateOptions<T>
  ): PausableLoadableAsyncNestedState<T>;
};

export default createAsyncNestedState;
