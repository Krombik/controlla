import type { AnyState, AsyncRoot, NOT_LOADED } from '../types';
import { RootKey } from '../utils/constants';
import deleteError from '../utils/deleteError';

const setValue = <S extends AnyState>(
  state: S,
  value: S extends AnyState<infer T> ? Exclude<T, typeof NOT_LOADED> : never
) => {
  const root = state.r;

  const rootValue = root.get(RootKey.VALUE);

  root.get(RootKey.VALUE_SET)!(
    typeof value != 'function' ? value : value(rootValue),
    rootValue,
    true,
    state._p!,
    false
  );

  deleteError(root as AsyncRoot);

  return state;
};

export default setValue;
