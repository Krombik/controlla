import type { AnyAsyncState } from '../types';
import { RootKey } from '../utils/constants';
import deleteValue from '../utils/deleteValue';
import executeSetters from '../utils/executeSetters';

const setError = <S extends AnyAsyncState>(
  state: S,
  error: S extends AnyAsyncState<any, infer E> ? E : never
) => {
  const root = state.r;

  deleteValue(root, true);

  if (!root.has(RootKey.ERROR) || root.get(RootKey.ERROR)! !== error) {
    root.set(RootKey.ERROR, error);

    executeSetters(root.get(RootKey.ERROR_CALLBACK_SET)!, error);
  }

  return state;
};

export default setError;
