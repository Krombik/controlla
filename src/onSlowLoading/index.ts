import type { AsyncState } from '../types';

/**
 * Registers a callback to be invoked when the given {@link state} triggers a slow loading timeout.
 * Throws an error if the state does not have a slow loading timeout configured.
 *
 * @param state - The asynchronous state to monitor.
 * @param cb - The callback function to invoke when the loading is considered slow.
 * @returns A function to remove the registered callback.
 *
 * @throws {Error} - If the state does not have a slow loading timeout configured.
 *
 * @example
 * ```js
 * const asyncState = createAsyncState({
 *   ...options,
 *   loadingTimeout: 3000, // Configure the slow loading timeout
 * });
 *
 * const unsubscribe = onSlowLoading(asyncState, () => {
 *   console.warn('Loading is taking longer than expected.');
 * });
 *
 * // To remove the callback later
 * unsubscribe();
 * ```
 */
const onSlowLoading = (state: AsyncState, cb: () => void) => {
  const slowLoading = state._internal._slowLoading;

  if (!slowLoading) {
    throw new Error('slow loading timeout was not provided');
  }

  const set = slowLoading._callbackSet;

  set.add(cb);

  return () => {
    set.delete(cb);
  };
};

export default onSlowLoading;
