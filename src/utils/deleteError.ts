import type { AsyncRoot } from '../types';
import { RootKey } from './constants';
import executeSetters from './executeSetters';

const deleteError = (root: AsyncRoot) => {
  if (root.delete(RootKey.ERROR)) {
    executeSetters(root.get(RootKey.ERROR_CALLBACK_SET)!, undefined);
  }
};

export default deleteError;
