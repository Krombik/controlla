import type { LoadableState } from '../types';

const onSlowLoading = (state: LoadableState<any>, cb: () => void) => {
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
