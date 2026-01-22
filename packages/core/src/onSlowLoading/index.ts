import type { ReadonlyAsyncControl } from '#types';
import { ROOT } from '#shared/constants';

/**
 * Registers a callback to be invoked when the given {@link control} triggers a slow loading timeout.
 * Throws an error if the control does not have a slow loading timeout configured.
 *
 * @param control - The asynchronous control to monitor.
 * @param cb - The callback function to invoke when the loading is considered slow.
 * @returns A function to remove the registered callback.
 *
 * @throws {Error} - If the control does not have a slow loading timeout configured.
 *
 * @example
 * ```js
 * const asyncControl = createAsyncControl({
 *   ...options,
 *   loadingTimeout: 3000, // Configure the slow loading timeout
 * });
 *
 * const unsubscribe = onSlowLoading(asyncControl, () => {
 *   console.warn('Loading is taking longer than expected.');
 * });
 *
 * // To remove the callback later
 * unsubscribe();
 * ```
 */
const onSlowLoading = (control: ReadonlyAsyncControl, cb: () => void) => {
  const slowLoading = control[ROOT]._root._slowLoading;

  if (!slowLoading) {
    throw new Error('slow loading timeout was not provided');
  }

  const callbacks = slowLoading._callbacks;

  const indexMap = slowLoading._indexMap;

  if (!indexMap.has(cb)) {
    indexMap.set(cb, callbacks.length);

    callbacks.push(cb);
  }

  return () => {
    if (indexMap.has(cb)) {
      const last = callbacks.pop()!;

      if (last != cb) {
        const index = indexMap.get(cb)!;

        callbacks[index] = last;

        indexMap.set(last, index)!;
      }

      indexMap.delete(cb);
    }
  };
};

export default onSlowLoading;
