import type {
  StateInitializer,
  PollableStateOptions,
  PollableStateScope,
} from '../types';
import createLoader from '../utils/createLoader';
import createScope from '../utils/createScope';
import getAsyncState from '../utils/getAsyncState';
import { handlePolling, PollingControl } from '../utils/handlePolling';
import { set } from '../utils/state/scope';

const createPollableStateScope: {
  /** Creates a {@link ControllableLoadableNestedState controllable loadable nested state} with polling capabilities. */
  <T, E = any>(
    options: PollableStateOptions<T, E>,
    stateInitializer?: StateInitializer<T>
  ): PollableStateScope<T, E>;
} = (
  options: PollableStateOptions<any, any, any[]>,
  stateInitializer?: StateInitializer,
  keys?: any[],
  tickStart?: () => void,
  tickEnd?: () => void,
  parent?: any
) =>
  createScope(
    getAsyncState(
      set,
      options,
      stateInitializer,
      keys,
      createLoader(handlePolling, options),
      PollingControl,
      tickStart,
      tickEnd,
      parent
    )
  );

export default createPollableStateScope;
