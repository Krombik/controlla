import createState from '../createState';
import type {
  AsyncState,
  AsyncStateOptions,
  LoadableState,
  LoadableStateOptions,
  ControllableLoadableState,
  ControllableLoadableStateOptions,
  StateInitializer,
} from '../types';
import getAsyncStateCreator from '../utils/getAsyncStateCreator';

const createAsyncState = getAsyncStateCreator(createState) as {
  <T, E = any>(
    options: ControllableLoadableStateOptions<T, E>,
    stateInitializer?: StateInitializer<T>
  ): ControllableLoadableState<T, E>;
  <T, E = any>(
    options: LoadableStateOptions<T, E>,
    stateInitializer?: StateInitializer<T>
  ): LoadableState<T, E>;
  <T, E = any>(
    options?: AsyncStateOptions<T>,
    stateInitializer?: StateInitializer<T>
  ): AsyncState<T, E>;
};

export type { AsyncState, LoadableState, ControllableLoadableState };

export default createAsyncState;
