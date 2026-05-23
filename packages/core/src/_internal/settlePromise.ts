import { AsyncControlInternals } from './types';

const settlePromise = (
  root: Pick<AsyncControlInternals, '_value' | '_promise'>,
  isOk: boolean,
  value: any
) => {
  const p = root._promise;

  if (p) {
    (isOk ? p._resolve : p._reject)(value);

    root._promise = undefined;
  }
};

export default settlePromise;
