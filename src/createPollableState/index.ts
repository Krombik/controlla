import createAsyncState from '../createAsyncState';
import type { ControllableState, PollableStateOptions } from '../types';
import getPollableStateCreator from '../utils/getPollableStateCreator';

const createPollableState = getPollableStateCreator(createAsyncState) as {
  <T, E = any>(options: PollableStateOptions<T, E>): ControllableState<T, E>;
};

export default createPollableState;
