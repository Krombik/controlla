import identity from 'lodash.identity';
import type { CallbackSet, Root, State } from '../types';
import executeSetters from '../utils/executeSetters';
import { RootKey } from '../utils/constants';

const createState = <T>(value?: T | (() => T)): State<T> => {
  const root: Root = new Map();

  const valueSet: CallbackSet = new Set();

  root.set(RootKey.VALUE_GET_CALLBACK_SET, () => valueSet);

  root.set(RootKey.VALUE_GET, identity);

  root.set(RootKey.VALUE_SET, (value, prevValue, isSet) => {
    if (prevValue !== value) {
      if (isSet) {
        root.set(RootKey.VALUE, value);
      }

      executeSetters(valueSet, value);
    }
  });

  if (typeof value == 'function') {
    value = (value as () => T)();
  }

  if (value !== undefined) {
    root.set(RootKey.VALUE, value);
  }

  return { r: root };
};

export default createState;
