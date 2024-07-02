import type { AnyAsyncState, NOT_LOADED } from '../types';
import { EMPTY_ARR, RootKey } from '../utils/constants';

const getPromise = <T>(
  state: AnyAsyncState<T>
): Promise<Exclude<T, typeof NOT_LOADED>> => {
  const root = state.r;

  const path = state._p;

  let promise: Promise<any>;

  if (root.has(RootKey.PROMISE)) {
    promise = root.get(RootKey.PROMISE)!;
  } else {
    const valueSet = root.get(RootKey.VALUE_GET_CALLBACK_SET)!(EMPTY_ARR);

    const errorSet = root.get(RootKey.ERROR_CALLBACK_SET)!;

    promise = (
      root.has(RootKey.VALUE)
        ? Promise.resolve(root.get(RootKey.VALUE)!)
        : root.has(RootKey.ERROR)
          ? Promise.reject(root.get(RootKey.ERROR))
          : new Promise<any>((res, rej) => {
              const resolve = (value: unknown) => {
                valueSet.delete(resolve);

                errorSet.delete(reject);

                res(value);
              };

              const reject = (error: unknown) => {
                valueSet.delete(resolve);

                errorSet.delete(reject);

                rej(error);
              };

              valueSet.add(resolve);

              errorSet.add(reject);
            })
    ).finally(() => {
      const cleanup = () => {
        valueSet.delete(cleanup);

        errorSet.delete(cleanup);

        root.delete(RootKey.PROMISE);
      };

      valueSet.add(cleanup);

      errorSet.add(cleanup);
    });

    root.set(RootKey.PROMISE, promise);
  }

  return path && path.length
    ? promise.then((value) => root.get(RootKey.VALUE_GET)!(value, path))
    : promise;
};

export default getPromise;
