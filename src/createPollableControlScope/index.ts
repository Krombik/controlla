import type {
  ControlInitializer,
  PollableControlOptions,
  PollableControlScope,
} from '../types';
import createLoader from '../utils/createLoader';
import createScope from '../utils/createScope';
import getAsyncControl from '../utils/getAsyncControl';
import { handlePolling, PollingControl } from '../utils/handlePolling';
import { set } from '../utils/control/scope';

const createPollableControlScope: {
  /** Creates a controllable loadable nested control with polling capabilities. */
  <T, E = any>(
    options: PollableControlOptions<T, E>,
    controlInitializer?: ControlInitializer<T | undefined>
  ): PollableControlScope<T, E>;
} = (
  options: PollableControlOptions<any, any, any[]>,
  controlInitializer?: ControlInitializer,
  keys?: any[],
  tickStart?: () => void,
  tickEnd?: () => void,
  parent?: any
) =>
  createScope(
    getAsyncControl(
      set,
      options,
      createLoader(handlePolling, options),
      keys,
      controlInitializer,
      PollingControl,
      tickStart,
      tickEnd,
      parent
    )
  );

export default createPollableControlScope;
