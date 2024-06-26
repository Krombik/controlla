import createState from '../createState';
import {
  AsyncState,
  AsyncStateOptions,
  LoadableAsyncState,
  LoadableAsyncStateOptions,
  PausableLoadableAsyncState,
  PausableLoadableAsyncStateOptions,
} from '../types';
import getAsyncStateCreator from '../utils/getAsyncStateCreator';

const createAsyncState = getAsyncStateCreator(createState) as {
  (options: {
    [key in keyof PausableLoadableAsyncStateOptions<any>]: never;
  }): never;
  <T>(options?: AsyncStateOptions<T>): AsyncState<T>;
  <T>(options: LoadableAsyncStateOptions<T>): LoadableAsyncState<T>;
  <T>(
    options: PausableLoadableAsyncStateOptions<T>
  ): PausableLoadableAsyncState<T>;
};

export default createAsyncState;
