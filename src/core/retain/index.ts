import { INTERNALS } from '#internal/constants';
import type { ReadonlyControl } from '#types';

/**
 * Keeps the given {@link control} in use without reading its value: if it
 * hasn't loaded yet, this starts its load; if it's already loaded, nothing
 * reloads — but the hold keeps it in use, so an `invalidate` while held loads
 * it again and any polling/revalidation keeps running. Use it to prefetch data
 * before it's shown, or to keep it updating in the background. For derived and
 * bound controls it keeps their loadable sources in use.
 *
 * @returns a `release` function; once it's called and nothing else is using
 * the control, it stops loading (any polling halts). Calling it more than once
 * does nothing.
 *
 * @example
 * ```ts
 * const release = retain($products); // load it before it's rendered
 * // ...later, when no longer needed
 * release();
 * ```
 */
const retain = (control: ReadonlyControl) => {
  let isCallable = true;

  const root = control[INTERNALS]._root;

  root._attach(undefined, undefined, true);

  return () => {
    if (isCallable) {
      isCallable = false;

      root._detach(undefined, undefined, true);
    }
  };
};

export default retain;
