import createNestedState from '../createNestedState';
import type {
  AsyncNestedState,
  AsyncStateOptions,
  LoadableNestedState,
  LoadableStateOptions,
  ControllableNestedState,
  ControllableStateOptions,
  OriginalStateCreator,
  StateType,
} from '../types';
import getAsyncStateCreator from '../utils/getAsyncStateCreator';

const createAsyncNestedState = getAsyncStateCreator(createNestedState);

export default createAsyncNestedState as OriginalStateCreator<
  {
    <T, E = any>(
      options: ControllableStateOptions<T, E>
    ): ControllableNestedState<T, E>;
    <T, E = any>(
      options: LoadableStateOptions<T, E>
    ): LoadableNestedState<T, E>;
    <T, E = any>(options?: AsyncStateOptions<T>): AsyncNestedState<T, E>;
  },
  StateType.NESTED_ASYNC_STATE
>;
