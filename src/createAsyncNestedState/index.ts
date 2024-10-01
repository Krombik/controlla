import createNestedState from '../createNestedState';
import type {
  AsyncNestedState,
  AsyncStateOptions,
  LoadableNestedState,
  LoadableStateOptions,
  ControllableNestedState,
  ControllableStateOptions,
  InitModule,
} from '../types';
import getAsyncStateCreator from '../utils/getAsyncStateCreator';

const createAsyncNestedState = getAsyncStateCreator(createNestedState) as {
  <T, E = any>(
    options: ControllableStateOptions<T, E>,
    initModule?: InitModule<T>
  ): ControllableNestedState<T, E>;
  <T, E = any>(
    options: LoadableStateOptions<T, E>,
    initModule?: InitModule<T>
  ): LoadableNestedState<T, E>;
  <T, E = any>(
    options?: AsyncStateOptions<T>,
    initModule?: InitModule<T>
  ): AsyncNestedState<T, E>;
};

export default createAsyncNestedState;
