import type { StateInternalUtils } from '../types';
import { RootKey } from './constants';

const deleteValue = (utils: StateInternalUtils, isError: boolean) => {
  if (utils._data.delete(RootKey.VALUE)) {
    utils._set(undefined, false, [], isError);
  }
};

export default deleteValue;
