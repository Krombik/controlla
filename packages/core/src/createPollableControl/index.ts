import type {
  PollableControlOptions,
  LoadableControl,
  PollableControl,
  SyncExternalStorage,
} from '#types';
import { ROOT } from '#shared/constants';
import createLoader from '#utils/createLoader';
import getAsyncControl from '#utils/getAsyncControl';
import { handlePolling, PollingControl } from '#utils/handlePolling';

import { set } from '#utils/control/common';

const createPollableControl = ((
  options: PollableControlOptions<any, any, any[]>,
  syncExternalStorage?: SyncExternalStorage,
  keys?: any[],
  tickStart?: () => void,
  tickEnd?: () => void
) => ({
  [ROOT]: getAsyncControl(
    set,
    options,
    createLoader(handlePolling, options),
    keys,
    syncExternalStorage,
    PollingControl,
    tickStart,
    tickEnd
  ),
})) as {
  /** Creates a {@link LoadableControl loadable control} with polling capabilities. */
  <T, E = any>(
    options: PollableControlOptions<T, E>,
    syncExternalStorage?: SyncExternalStorage<T | undefined>
  ): PollableControl<T, E>;
};

export default createPollableControl;
