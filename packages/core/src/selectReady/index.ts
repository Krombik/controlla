import type { ReadonlyAsyncControl } from '#types';
import { INTERNALS } from '#shared-internal/constants';

/** Makes the given {@link control} to be awaited only, without triggering re-renders on control changes. */
const selectReady = <E>(
  control: ReadonlyAsyncControl<any, E>
): ReadonlyAsyncControl<true, E> =>
  control[INTERNALS]._root._readyControl as any;

export default selectReady;
