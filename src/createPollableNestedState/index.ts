import createAsyncNestedState from '../createAsyncNestedState';
import type {
  ControllableLoadableNestedState,
  StateInitializer,
  PollableStateOptions,
} from '../types';
import getPollableStateCreator from '../utils/getPollableStateCreator';

const createPollableNestedState = getPollableStateCreator(
  createAsyncNestedState
) as {
  /** Creates a {@link ControllableLoadableNestedState controllable loadable nested state} with polling capabilities. */
  <T, E = any>(
    options: PollableStateOptions<T, E>,
    stateInitializer?: StateInitializer<T>
  ): ControllableLoadableNestedState<T, E>;
};

export default createPollableNestedState;
