import getValue from '../getValue';
import type { AsyncState, ResolvedValue } from '../types';
import { RootKey } from '../utils/constants';

const getPromise: {
  <T>(state: AsyncState<T>): Promise<ResolvedValue<T>>;
  /** @internal */
  (state: AsyncState<any>, isRoot: true): Promise<any>;
} = (state: AsyncState<any>, isRoot?: true) => {
  const utils = state._internal;

  const data = utils._data;

  const path = state._path;

  let promise: Promise<any>;

  if (data.has(RootKey.PROMISE)) {
    promise = data.get(RootKey.PROMISE)!;
  } else if (getValue(state.isLoaded)) {
    promise = data.has(RootKey.VALUE)
      ? Promise.resolve(data.get(RootKey.VALUE)!)
      : Promise.reject(getValue(state.error));
  } else {
    data.set(
      RootKey.PROMISE,
      (promise = new Promise((res, rej) => {
        data.set(RootKey.PROMISE_RESOLVE, res);

        data.set(RootKey.PROMISE_REJECT, rej);
      }))
    );
  }

  return path && path.length && !isRoot
    ? promise.then((value) => utils._get(value, path))
    : promise;
};

export default getPromise;
