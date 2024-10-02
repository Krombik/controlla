import createAsyncNestedState from '../createAsyncNestedState';
import type {
  ControllableLoadableNestedState,
  InitModule,
  PollableStateOptions,
} from '../types';
import getPollableStateCreator from '../utils/getPollableStateCreator';

const createPollableNestedState = getPollableStateCreator(
  createAsyncNestedState
) as {
  <T, E = any>(
    options: PollableStateOptions<T, E>,
    initModule?: InitModule<T>
  ): ControllableLoadableNestedState<T, E>;
};

export default createPollableNestedState;
