import createNestedState from '../createNestedState';
import type {
  AsyncNestedState,
  AsyncStateOptions,
  LoadableNestedState,
  LoadableStateOptions,
  ControllableNestedState,
  ControllableStateOptions,
} from '../types';
import getAsyncStateCreator from '../utils/getAsyncStateCreator';

const createAsyncNestedState = getAsyncStateCreator(createNestedState) as {
  <T, E = any>(options?: AsyncStateOptions<T>): AsyncNestedState<T, E>;
  <T, E = any>(options: LoadableStateOptions<T, E>): LoadableNestedState<T, E>;
  <T, E = any>(
    options: ControllableStateOptions<T, E>
  ): ControllableNestedState<T, E>;
};

export default createAsyncNestedState;
