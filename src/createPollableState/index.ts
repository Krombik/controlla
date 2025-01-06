import type {
  StateInitializer,
  PollableStateOptions,
  LoadableState,
  PollableState,
} from '../types';
import createLoader from '../utils/createLoader';
import getAsyncState from '../utils/getAsyncState';
import { handlePolling, PollingControl } from '../utils/handlePolling';

import { set } from '../utils/state/common';

const createPollableState = ((
  options: PollableStateOptions<any, any, any[]>,
  stateInitializer?: StateInitializer,
  keys?: any[],
  tickStart?: () => void,
  tickEnd?: () => void,
  parent?: any
) =>
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
  )) as {
  /** Creates a {@link LoadableState loadable state} with polling capabilities. */
  <T, E = any>(
    options: PollableStateOptions<T, E>,
    stateInitializer?: StateInitializer<T>
  ): PollableState<T, E>;
};

export default createPollableState;
