import type { ReadonlyAsyncControl } from '#types';
import { INTERNALS } from '#shared-internal/constants';
import selectPromise from '#internal/selectPromise';

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
  const internals = control[INTERNALS];

  return internals._path
    ? selectPromise(internals[INTERNALS]).then(() => internals._get())
    : selectPromise(internals[INTERNALS]);
};

export default getPromise;
