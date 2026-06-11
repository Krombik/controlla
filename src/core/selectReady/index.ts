import type { ReadonlyAsyncControl } from '#types';
import { INTERNALS } from '#internal/constants';

/**
 * Returns the ready control of the given async {@link control} — its value is
 * `true` once the control has a loaded value, and `undefined` while it loads
 * (or after an error or `invalidate`). Use it to await or suspend on
 * readiness without rerendering on every value change.
 */
const selectReady = <E>(
  control: ReadonlyAsyncControl<any, E>
): ReadonlyAsyncControl<true, E> =>
  control[INTERNALS]._root._readyControl as any;

export default selectReady;
