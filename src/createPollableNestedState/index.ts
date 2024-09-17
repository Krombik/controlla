import createAsyncNestedState from '../createAsyncNestedState';
import type { ControllableNestedState, PollableStateOptions } from '../types';
import getPollableStateCreator from '../utils/getPollableStateCreator';

const createPollableNestedState = getPollableStateCreator(
  createAsyncNestedState
) as {
  <T, E = any>(
    options: PollableStateOptions<T, E>
  ): ControllableNestedState<T, E>;
};

export default createPollableNestedState;
