import createAsyncNestedState from '../createAsyncNestedState';

import {
  PausableLoadableAsyncNestedState,
  PollableStateOptions,
} from '../types';
import getPollableStateCreator from '../utils/getPollableStateCreator';

const createPollableNestedState = getPollableStateCreator(
  createAsyncNestedState
) as {
  <T, E = any>(
    options: PollableStateOptions<T, E>
  ): PausableLoadableAsyncNestedState<T, E>;
};

export default createPollableNestedState;
