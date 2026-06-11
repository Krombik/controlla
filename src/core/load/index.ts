import { INTERNALS } from '#internal/constants';
import type { ReadonlyControl } from '#types';

/**
 * Marks the given {@link control} as in use, starting its loading without
 * subscribing to values — e.g. for prefetching. For derived and bound
 * controls it loads their loadable sources.
 *
 * @returns a function that releases the hold; loading stops when no other
 * usage remains. Safe to call more than once.
 *
 * @example
 * ```ts
 * const release = load($products);   // prefetch
 * ```
 */
const load = (control: ReadonlyControl) => {
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

export default load;
