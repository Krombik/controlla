import createAsyncNestedState from '../createAsyncNestedState';
import type {
  ControllableNestedState,
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
  ): ControllableNestedState<T, E>;
};

export default createPollableNestedState;
