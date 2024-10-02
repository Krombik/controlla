import createAsyncState from '../createAsyncState';
import type {
  ControllableLoadableState,
  InitModule,
  PollableStateOptions,
} from '../types';
import getPollableStateCreator from '../utils/getPollableStateCreator';

const createPollableState = getPollableStateCreator(createAsyncState) as {
  <T, E = any>(
    options: PollableStateOptions<T, E>,
    initModule?: InitModule<T>
  ): ControllableLoadableState<T, E>;
};

export default createPollableState;
