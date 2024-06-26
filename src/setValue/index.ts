import { AnyState, AsyncRoot, RootKey } from '../types';
import deleteError from '../utils/deleteError';

const setValue = <S extends AnyState>(
  state: S,
  value: S extends AnyState<infer T> ? T : never
) => {
  const root = state.r;

  const rootValue = root.get(RootKey.VALUE);

  root.get(RootKey.VALUE_SET)!(
    typeof value != 'function' ? value : value(rootValue),
    rootValue,
    true,
    state.p!,
    false
  );

  deleteError(root as AsyncRoot);

  return state;
};

export default setValue;
