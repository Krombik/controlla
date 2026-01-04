import type {
  PollableControlOptions,
  PollableControlScope,
  SyncExternalStorage,
} from '#types';
import createLoader from '#utils/createLoader';
import createScope from '#utils/createScope';
import getAsyncControl from '#utils/getAsyncControl';
import { handlePolling, PollingControl } from '#utils/handlePolling';
import { set } from '#utils/control/scope';

const createPollableControlScope: {
  /** Creates a controllable loadable nested control with polling capabilities. */
  <T, E = any>(
    options: PollableControlOptions<T, E>,
    syncExternalStorage?: SyncExternalStorage<T | undefined>
  ): PollableControlScope<T, E>;
} = (
  options: PollableControlOptions<any, any, any[]>,
  syncExternalStorage?: SyncExternalStorage,
  keys?: any[],
  tickStart?: () => void,
  tickEnd?: () => void
) =>
  createScope(
    getAsyncControl(
      set,
      options,
      createLoader(handlePolling, options),
      keys,
      syncExternalStorage,
      PollingControl,
      tickStart,
      tickEnd
    )
  );

export default createPollableControlScope;
