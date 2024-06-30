import { AnyState, RootKey, NOT_LOADED } from '../types';

const onValueChange = <T>(
  state: AnyState<T>,
  cb: (value: Exclude<T, typeof NOT_LOADED>) => void
) => {
  const set = state.r.get(RootKey.VALUE_GET_CALLBACK_SET)!(state.p!);

  set.add(cb);

  return () => {
    set.delete(cb);
  };
};

export default onValueChange;
