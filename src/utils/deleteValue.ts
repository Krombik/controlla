import type { Root } from '../types';
import { EMPTY_ARR, RootKey } from './constants';

const deleteValue = (root: Root, isError: boolean) => {
  if (root.has(RootKey.VALUE)) {
    const rootValue = root.get(RootKey.VALUE)!;

    root.delete(RootKey.VALUE);

    root.get(RootKey.VALUE_SET)!(
      undefined,
      rootValue,
      false,
      EMPTY_ARR,
      isError
    );
  }
};

export default deleteValue;
