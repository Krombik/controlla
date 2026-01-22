import type { ReadonlyAsyncControl } from '#types';
import { ROOT } from '#shared/constants';

/**
 * @returns a promise that resolves with the current value of the given {@link control}.
 * If the control is not yet loaded, the promise waits until a value is available.
 * @example
 * ```js
 * getPromise(asyncControl).then((value) => {
 *   console.log('Loaded value:', value);
 * }).catch((error) => {
 *   console.error('Failed to load:', error);
 * });
 * ```
 */
const getPromise = <T>(control: ReadonlyAsyncControl<T>): Promise<T> => {
  const utils = control[ROOT];

  return utils._path
    ? utils._root._promise.then(() => utils._get())
    : utils._root._promise;
};

export default getPromise;
