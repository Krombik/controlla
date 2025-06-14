import type {
  ControlInitializer,
  PollableControlOptions,
  LoadableControl,
  PollableControl,
} from '../types';
import { ROOT } from '../utils/constants';
import createLoader from '../utils/createLoader';
import getAsyncControl from '../utils/getAsyncControl';
import { handlePolling, PollingControl } from '../utils/handlePolling';

import { set } from '../utils/control/common';

const createPollableControl = ((
  options: PollableControlOptions<any, any, any[]>,
  controlInitializer?: ControlInitializer,
  keys?: any[],
  tickStart?: () => void,
  tickEnd?: () => void,
  parent?: any
) => ({
  [ROOT]: getAsyncControl(
    set,
    options,
    createLoader(handlePolling, options),
    keys,
    controlInitializer,
    PollingControl,
    tickStart,
    tickEnd,
    parent
  ),
})) as {
  /** Creates a {@link LoadableControl loadable control} with polling capabilities. */
  <T, E = any>(
    options: PollableControlOptions<T, E>,
    controlInitializer?: ControlInitializer<T | undefined>
  ): PollableControl<T, E>;
};

export default createPollableControl;
