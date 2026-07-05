import { INTERNALS } from '#internal/constants';
import type { AsyncControlInternals } from '#internal/types';

const selectPromise = (root: AsyncControlInternals) => {
  if (root._promise) {
    return root._promise._promise;
  }

  if (root._value !== undefined) {
    return Promise.resolve(root._value);
  }

  const err = root._errorControl[INTERNALS]._value;

  if (err !== undefined) {
    return Promise.reject(err);
  }

  let resolve!: (value: any) => void, reject!: (err: any) => void;

  const promise = new Promise((res, rej) => {
    resolve = res;

    reject = rej;
  });

  root._promise = {
    _promise: promise,
    _reject: reject,
    _resolve: resolve,
  };

  return promise;
};

export default selectPromise;
