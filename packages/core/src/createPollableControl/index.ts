import type {
  PollableControlOptions,
  PollableControlScope,
  SyncExternalStorage,
} from '#types';
import createLoader from '#utils/createLoader';
import createScope from '#utils/createScope';
import getAsyncControl from '#utils/getAsyncControl';
import { handlePolling, PollingControl } from '#utils/handlePolling';

const createPollableControl: {
  /** Creates a controllable loadable nested control with polling capabilities. */
  <T, E = any>(
    options: PollableControlOptions<T>,
    syncExternalStorage?: SyncExternalStorage<T | undefined>
  ): PollableControlScope<T, E>;
} = (
  options: PollableControlOptions<any, any[]>,
  syncExternalStorage?: SyncExternalStorage,
  keys?: any[]
) =>
  createScope(
    getAsyncControl(
      options,
      createLoader(handlePolling, options.fetch),
      keys,
      syncExternalStorage,
      PollingControl
    )
  );

export default createPollableControl;
