import createState from '../createState';
import type {
  AsyncState,
  AsyncStateOptions,
  LoadableState,
  LoadableStateOptions,
  ControllableState,
  ControllableStateOptions,
  OriginalStateCreator,
  StateType,
} from '../types';
import getAsyncStateCreator from '../utils/getAsyncStateCreator';

const createAsyncState = getAsyncStateCreator(createState);

export default createAsyncState as OriginalStateCreator<
  {
    <T, E = any>(
      options: ControllableStateOptions<T, E>
    ): ControllableState<T, E>;
    <T, E = any>(options: LoadableStateOptions<T, E>): LoadableState<T, E>;
    <T, E = any>(options?: AsyncStateOptions<T>): AsyncState<T, E>;
  },
  StateType.ASYNC_STATE
>;
