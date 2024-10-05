import getValue from '../getValue';
import type { AsyncState } from '../types';

const getPromise: {
  <T>(state: AsyncState<T>): Promise<T>;
  /** @internal */
  (state: AsyncState<any>, isRoot: true): Promise<any>;
} = (state: AsyncState<any>, isRoot?: true) => {
  const utils = state._internal;

  if (!('_promise' in utils)) {
    throw new Error('available only for async state');
  }

  const data = utils._promise;

  const path = state._path;

  let promise: Promise<any>;

  if (data) {
    promise = data._promise;
  } else if (getValue(state.isLoaded)) {
    promise =
      utils._value !== undefined
        ? Promise.resolve(utils._value)
        : Promise.reject(utils._errorUtils._value);
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
    ? promise.then(() => utils._get(path))
    : promise;
};

export default getPromise;
