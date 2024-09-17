import type { LoadableState } from '../types';

const onSlowLoading = (state: LoadableState<any>, cb: () => void) => {
  const set = state._internal._slowLoadingCallbackSet!;

  set.add(cb);

  return () => {
    set.delete(cb);
  };
};

export default onSlowLoading;
