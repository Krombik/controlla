import type { AsyncState } from '../types';
import { ROOT } from '../utils/constants';

/**
 * @returns a promise that resolves with the current value of the given {@link state}.
 * If the state is not yet loaded, the promise waits until a value is available.
 * @example
 * ```js
 * getPromise(asyncState).then((value) => {
 *   console.log('Loaded value:', value);
 * }).catch((error) => {
 *   console.error('Failed to load:', error);
 * });
 * ```
 */
const getPromise = <T>(state: AsyncState<T>): Promise<T> => {
  const utils = state[ROOT];

  const root = utils[ROOT];

  const data = root._promise;

  let promise: Promise<any>;

  if (data) {
    promise = data._promise;
  } else if (root._isLoadedState[ROOT]._value) {
    promise =
      root._value !== undefined
        ? Promise.resolve(root._value)
        : Promise.reject(root._errorState[ROOT]._value);
  } else {
    let _resolve!: (value: any) => void, _reject!: (error: any) => void;

    promise = new Promise<any>((res, rej) => {
      _resolve = res;

      _reject = rej;
    });

    root._promise = {
      _promise: promise,
      _reject,
      _resolve,
    };
  }

  return utils._path ? promise.then(() => utils._get()) : promise;
};

export default getPromise;
