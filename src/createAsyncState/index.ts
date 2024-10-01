import createState from '../createState';
import type {
  AsyncState,
  AsyncStateOptions,
  LoadableState,
  LoadableStateOptions,
  ControllableState,
  ControllableStateOptions,
  InitModule,
} from '../types';
import getAsyncStateCreator from '../utils/getAsyncStateCreator';

const createAsyncState = getAsyncStateCreator(createState) as {
  <T, E = any>(
    options: ControllableStateOptions<T, E>,
    initModule?: InitModule<T>
  ): ControllableState<T, E>;
  <T, E = any>(
    options: LoadableStateOptions<T, E>,
    initModule?: InitModule<T>
  ): LoadableState<T, E>;
  <T, E = any>(
    options?: AsyncStateOptions<T>,
    initModule?: InitModule<T>
  ): AsyncState<T, E>;
};

export default createAsyncState;
