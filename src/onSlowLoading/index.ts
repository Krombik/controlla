import type { AsyncState } from '../types';

const onSlowLoading = (state: AsyncState, cb: () => void) => {
  const slowLoading = state._internal._slowLoading;

  if (!slowLoading) {
    throw new Error('slow loading timeout was not provided');
  }

  const set = slowLoading._callbackSet;

  set.add(cb);

  return () => {
    set.delete(cb);
  };
};

export default onSlowLoading;
