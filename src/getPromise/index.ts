import type { AsyncState } from '../types';

const getPromise: {
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
  <T>(state: AsyncState<T>): Promise<T>;
  /** @internal */
  (state: AsyncState, isRoot: true): Promise<any>;
} = (state: AsyncState, isRoot?: true) => {
  const utils = state._internal;

  const data = utils._promise;

  const path = state._path;

  let promise: Promise<any>;

  if (data) {
    promise = data._promise;
  } else if (state.isLoaded._value) {
    promise =
      utils._value !== undefined
        ? Promise.resolve(utils._value)
        : Promise.reject(state.error._value);
  } else {
    let _resolve!: (value: any) => void, _reject!: (error: any) => void;

    promise = new Promise<any>((res, rej) => {
      _resolve = res;

      _reject = rej;
    });

    utils._promise = {
      _promise: promise,
      _reject,
      _resolve,
    };
  }

  return path && path.length && !isRoot
    ? promise.then(() => state.get())
    : promise;
};

export default getPromise;
