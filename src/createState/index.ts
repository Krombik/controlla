import identity from 'lodash.identity';
import { CallbackSet, Root, RootKey, State } from '../types';
import executeSetters from '../utils/executeSetters';

const createState: {
  <T>(defaultValue: T): State<T>;
  <T>(): State<T | undefined>;
} = <T>(defaultValue?: T) => {
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

  if (defaultValue !== undefined) {
    root.set(RootKey.VALUE, defaultValue);
  }

  return { r: root };
};

export default createState;
