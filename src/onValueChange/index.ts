import type { AnyState, NOT_LOADED } from '../types';
import { RootKey } from '../utils/constants';

const onValueChange = <T>(
  state: AnyState<T>,
  cb: (value: Exclude<T, typeof NOT_LOADED>) => void
) => {
  const set = state.r.get(RootKey.VALUE_GET_CALLBACK_SET)!(state._p!);

  set.add(cb);

  return () => {
    set.delete(cb);
  };
};

export default onValueChange;
