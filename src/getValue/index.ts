import type { AnyState, NOT_LOADED } from '../types';
import { RootKey } from '../utils/constants';

const getValue = <T>(
  state: AnyState<T>
): [Extract<T, typeof NOT_LOADED>] extends [never]
  ? T
  : Exclude<T, typeof NOT_LOADED> | undefined => {
  const root = state.r;

  return root.get(RootKey.VALUE_GET)!(root.get(RootKey.VALUE), state._p!);
};

export default getValue;
