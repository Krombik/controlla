import createAsyncNestedState from '../createAsyncNestedState';
import type {
  ControllableNestedState,
  OriginalStateCreator,
  PollableStateOptions,
  StateType,
} from '../types';
import getPollableStateCreator from '../utils/getPollableStateCreator';

const createPollableNestedState = getPollableStateCreator(
  createAsyncNestedState
);

export default createPollableNestedState as OriginalStateCreator<
  {
    <T, E = any>(
      options: PollableStateOptions<T, E>
    ): ControllableNestedState<T, E>;
  },
  StateType.NESTED_POLLABLE_STATE
>;
