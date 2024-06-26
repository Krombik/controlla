import { Key, NestedMap } from '../types';
import alwaysFalse from './alwaysFalse';
import { EMPTY_ARR } from './constants';
import executeSetters from './executeSetters';

const objectPrototype = Object.prototype;

const forEachChild = (storage: NestedMap, fn: (key: Key) => void) => {
  const it = storage.keys();

  const next = it.next.bind(it);

  next(); // skip set

  for (let i = storage.size - 1; i--; ) {
    fn(next().value);
  }
};

const handleMandatoryCheck = (
  prevValue: any,
  nextValue: any,
  storage: NestedMap | undefined | false
): ((key: Key) => boolean) | false => {
  if (storage && storage.size > 1) {
    let equalList: Set<Key> | false = new Set();

    forEachChild(storage, (key) => {
      const child = storage.get(key)!;

      const newValue = nextValue[key];

      if (handleNotEqual(prevValue[key], newValue, child)) {
        equalList = false;

        executeSetters(child.get(EMPTY_ARR)!, newValue);
      } else if (equalList) {
        equalList.add(key);
      }
    });

    return equalList && equalList.has.bind(equalList);
  }

  return alwaysFalse;
};

const handleNil = (prevValue: any, nextValue: any, storage: NestedMap) => {
  executeSetters(storage.get(EMPTY_ARR)!, nextValue);

  if (prevValue != nextValue && storage.size > 1) {
    forEachChild(
      storage,
      prevValue == null
        ? (key) => {
            const next = nextValue[key];

            if (next !== undefined) {
              handleNil(undefined, next, storage.get(key)!);
            }
          }
        : (key) => {
            const prev = prevValue[key];

            if (prev !== undefined) {
              handleNil(prev, undefined, storage.get(key)!);
            }
          }
    );
  }
};

const handleNotEqual = (
  prevValue: any,
  nextValue: any,
  storage: NestedMap | undefined | false
) => {
  if (prevValue === nextValue) {
    return false;
  }

  if (prevValue == null || nextValue == null) {
    if (storage) {
      handleNil(prevValue, nextValue, storage);
    }

    return true;
  }

  const aPrototype = Object.getPrototypeOf(prevValue);

  if (aPrototype != Object.getPrototypeOf(nextValue)) {
    if (storage) {
      executeSetters(storage.get(EMPTY_ARR)!, nextValue);

      handleMandatoryCheck(prevValue, nextValue, storage);
    }

    return true;
  }

  if (aPrototype == objectPrototype) {
    const isChecked = handleMandatoryCheck(prevValue, nextValue, storage);

    if (!isChecked) {
      return true;
    }

    const aKeys = Object.keys(prevValue);

    let i = aKeys.length;

    if (i != Object.keys(nextValue).length) {
      return true;
    }

    const getStorage = storage
      ? (storage.get.bind(storage) as (typeof storage)['get'])
      : alwaysFalse;

    while (i--) {
      const key = aKeys[i];

      if (
        !isChecked(key) &&
        handleNotEqual(prevValue[key], nextValue[key], getStorage(key))
      ) {
        return true;
      }
    }

    return false;
  }

  if (Array.isArray(prevValue)) {
    const isChecked = handleMandatoryCheck(prevValue, nextValue, storage);

    if (!isChecked) {
      return true;
    }

    const l = prevValue.length;

    if (l != nextValue.length) {
      return true;
    }

    const getStorage = storage
      ? (storage.get.bind(storage) as (typeof storage)['get'])
      : alwaysFalse;

    for (let i = 0; i < l; i++) {
      if (
        !isChecked(i) &&
        handleNotEqual(prevValue[i], nextValue[i], getStorage(i))
      ) {
        return true;
      }
    }

    return false;
  }

  if (prevValue instanceof Date) {
    return prevValue.getTime() != nextValue.getTime();
  }

  return true;
};

export default handleNotEqual;
