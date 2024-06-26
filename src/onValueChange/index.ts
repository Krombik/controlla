import { AnyState, RootKey } from '../types';

const onValueChange = <T>(state: AnyState<T>, cb: (value: T) => void) => {
  const set = state.r.get(RootKey.VALUE_GET_CALLBACK_SET)!(state.p!);

  set.add(cb);

  return () => {
    set.delete(cb);
  };
};

export default onValueChange;
