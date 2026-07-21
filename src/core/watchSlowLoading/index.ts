import type { AsyncControl } from '#types';
import { INTERNALS } from '#internal/constants';
import { addListener, removeListener } from '#internal/flushQueue';
import noop from '#internal/noop';

/**
 * Registers a callback invoked when a loading of the given {@link control}
 * exceeds its `loadingTimeout`. Throws if the control was created without
 * `loadingTimeout`.
 *
 * @returns a function to stop watching.
 *
 * @example
 * ```ts
 * const unwatch = watchSlowLoading($products, () => {
 *   console.warn('products are slow to load');
 * });
 * ```
 */
const watchSlowLoading = (control: AsyncControl, cb: () => void) => {
  const root = control[INTERNALS]._root;

  const slowLoadMonitor = root._load && root._load._slowLoadMonitor;

  if (!slowLoadMonitor) {
    // $never never loads, so there's nothing to watch — a no-op, not an error
    if ('_fakeSuspense' in root) {
      return noop;
    }

    throw new Error('the control has no loadingTimeout');
  }

  addListener(slowLoadMonitor, cb);

  return () => {
    removeListener(slowLoadMonitor, cb);
  };
};

export default watchSlowLoading;
