import type {
  PollableControlOptions,
  PollableControlScope,
  SyncExternalStorage,
} from '#types';
import createLoadRunner from '#internal/createLoadRunner';
import createScope from '#internal/createScope';
import createAsyncRoot from '#internal/createAsyncRoot';
import { polling, PollingProcess } from '#internal/polling';

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
    createAsyncRoot(
      options,
      createLoadRunner(polling, options.fetch),
      keys,
      syncExternalStorage,
      PollingProcess
    )
  );

export default createPollableControl;
