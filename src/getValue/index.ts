import { AnyState, RootKey } from '../types';

const getValue = <T>(state: AnyState<T>): T => {
  const root = state.r;

  return root.get(RootKey.VALUE_GET)!(root.get(RootKey.VALUE), state.p!);
};

export default getValue;
