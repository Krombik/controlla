import type {
  StateInitializer,
  PollableStateOptions,
  StateCallbackMap,
  PollableStateScope,
} from '../types';
import createLoader from '../utils/createLoader';
import createScope from '../utils/createScope';
import getAsyncState from '../utils/getAsyncState';
import { handlePolling, PollingControl } from '../utils/handlePolling';
import { _onValueChange, get, set } from '../utils/state/scope';

const createPollableStateScope: {
  /** Creates a {@link ControllableLoadableNestedState controllable loadable nested state} with polling capabilities. */
  <T, E = any>(
    options: PollableStateOptions<T, E>,
    stateInitializer?: StateInitializer<T>
  ): PollableStateScope<T, E>;
} = (
  options: PollableStateOptions<any, any, any[]>,
  stateInitializer?: StateInitializer,
  keys?: any[]
) =>
  createScope(
    getAsyncState<StateCallbackMap>(
      get,
      set,
      _onValueChange,
      options,
      stateInitializer,
      keys,
      { _root: null, _children: null },
      createLoader(handlePolling, options),
      PollingControl
    )
  );

export default createPollableStateScope;
