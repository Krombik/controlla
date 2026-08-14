import type { AsyncControlInternals } from '#internal/types';

const armPromise = (root: Pick<AsyncControlInternals, '_promise'>) => {
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

export default armPromise;
