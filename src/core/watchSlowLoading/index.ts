import type { AsyncControl } from '#types';
import { INTERNALS } from '#internal/constants';

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
  const slowLoadMonitor = control[INTERNALS]._root._load!._slowLoadMonitor;

  if (!slowLoadMonitor) {
    throw new Error('slow loading timeout was not provided');
  }

  const listeners = slowLoadMonitor._listeners;

  listeners.add(cb);

  return () => {
    listeners.delete(cb);
  };
};

export default watchSlowLoading;
