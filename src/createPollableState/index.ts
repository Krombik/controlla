import createAsyncState from '../createAsyncState';
import type {
  PausableLoadableAsyncState,
  PollableStateOptions,
} from '../types';
import getPollableStateCreator from '../utils/getPollableStateCreator';

const createPollableState = getPollableStateCreator(createAsyncState) as {
  <T, E = any>(
    options: PollableStateOptions<T, E>
  ): PausableLoadableAsyncState<T, E>;
};

export default createPollableState;
