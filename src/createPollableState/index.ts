import createAsyncState from '../createAsyncState';
import type {
  ControllableState,
  OriginalStateCreator,
  PollableStateOptions,
  StateType,
} from '../types';
import getPollableStateCreator from '../utils/getPollableStateCreator';

const createPollableState = getPollableStateCreator(createAsyncState);

export default createPollableState as OriginalStateCreator<
  {
    <T, E = any>(options: PollableStateOptions<T, E>): ControllableState<T, E>;
  },
  StateType.POLLABLE_STATE
>;
