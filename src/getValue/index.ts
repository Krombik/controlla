import { AnyState, RootKey, NOT_LOADED } from '../types';

const getValue = <T>(
  state: AnyState<T>
): [Extract<T, typeof NOT_LOADED>] extends [never]
  ? T
  : Exclude<T, typeof NOT_LOADED> | undefined => {
  const root = state.r;

  return root.get(RootKey.VALUE_GET)!(root.get(RootKey.VALUE), state.p!);
};

export default getValue;
