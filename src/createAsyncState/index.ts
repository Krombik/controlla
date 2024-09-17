import createState from '../createState';
import type {
  AsyncState,
  AsyncStateOptions,
  LoadableState,
  LoadableStateOptions,
  ControllableState,
  ControllableStateOptions,
} from '../types';
import getAsyncStateCreator from '../utils/getAsyncStateCreator';

const createAsyncState = getAsyncStateCreator(createState) as {
  <T, E = any>(options?: AsyncStateOptions<T>): AsyncState<T, E>;
  <T, E = any>(
    options: ControllableStateOptions<T, E>
  ): ControllableState<T, E>;
  <T, E = any>(options: LoadableStateOptions<T, E>): LoadableState<T, E>;
};

export default createAsyncState;
