import type { ReadonlyAsyncControl } from '#types';
import { INTERNALS } from '#internal/constants';

/**
 * Returns the ready control of the given async {@link control} — its value is
 * `true` once the control has a value, `undefined` before it ever resolves or
 * while pending with no value (first load, after `invalidate` or an error).
 * Unlike loading, it stays `true` through a background reload that keeps the
 * value. Use it to await or suspend on readiness without rerendering on every
 * value change.
 */
const selectReady = <E>(
  control: ReadonlyAsyncControl<any, E>
): ReadonlyAsyncControl<true, E> =>
  control[INTERNALS]._root._readyControl as any;

export default selectReady;
