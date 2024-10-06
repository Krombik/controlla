import createNestedState from '../createNestedState';
import type {
  AsyncNestedState,
  AsyncStateOptions,
  LoadableNestedState,
  LoadableStateOptions,
  ControllableLoadableNestedState,
  ControllableLoadableStateOptions,
  StateInitializer,
} from '../types';
import getAsyncStateCreator from '../utils/getAsyncStateCreator';

const createAsyncNestedState = getAsyncStateCreator(createNestedState) as {
  <T, E = any>(
    options: ControllableLoadableStateOptions<T, E>,
    stateInitializer?: StateInitializer<T>
  ): ControllableLoadableNestedState<T, E>;
  <T, E = any>(
    options: LoadableStateOptions<T, E>,
    stateInitializer?: StateInitializer<T>
  ): LoadableNestedState<T, E>;
  <T, E = any>(
    options?: AsyncStateOptions<T>,
    stateInitializer?: StateInitializer<T>
  ): AsyncNestedState<T, E>;
};

export type {
  AsyncNestedState,
  LoadableNestedState,
  ControllableLoadableNestedState,
};

export default createAsyncNestedState;
