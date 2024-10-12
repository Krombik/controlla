import type { PathKey, StateCallbackMap } from '../types';
import alwaysFalse from './alwaysFalse';
import addToBatch from './batching';

const objectPrototype = Object.prototype;

const forEachChild = (
  storage: Map<PathKey, StateCallbackMap>,
  fn: (key: PathKey) => void
) => {
  const it = storage.keys();

  const next = it.next.bind(it);

  for (let i = storage.size; i--; ) {
    fn(next().value);
  }
};

const handleMandatoryCheck = (
  prevValue: any,
  nextValue: any,
  storage: Map<PathKey, StateCallbackMap>
): ((key: PathKey) => boolean) | false => {
  let equalList: Set<PathKey> | false = new Set();

  forEachChild(storage, (key) => {
    const child = storage.get(key)!;

    const newValue = nextValue[key];

    if (processStateChanges(prevValue[key], newValue, child)) {
      equalList = false;

      if (child._root) {
        addToBatch(child._root, newValue);
      }
    } else if (equalList) {
      equalList.add(key);
    }
  });

  return equalList && equalList.has.bind(equalList);
};

const handleNil = (
  prevValue: any,
  nextValue: any,
  storage: StateCallbackMap
) => {
  const { _children, _root } = storage;

  if (_root) {
    addToBatch(_root, nextValue);
  }

  if (_children && prevValue != nextValue) {
    forEachChild(
      _children,
      prevValue == null
        ? (key) => {
            const next = nextValue[key];

            if (next !== undefined) {
              handleNil(undefined, next, _children.get(key)!);
            }
          }
        : (key) => {
            const prev = prevValue[key];

            if (prev !== undefined) {
              handleNil(prev, undefined, _children.get(key)!);
            }
          }
    );
  }
};

const processStateChanges = (
  prevValue: any,
  nextValue: any,
  storage: StateCallbackMap | undefined | false | null
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

  const root = storage && storage._root;

  const children = storage && storage._children;

  if (aPrototype != Object.getPrototypeOf(nextValue)) {
    if (storage) {
      if (root) {
        addToBatch(root, nextValue);
      }

      if (children) {
        handleMandatoryCheck(prevValue, nextValue, children);
      }
    }

    return true;
  }

  if (aPrototype == objectPrototype) {
    const isChecked = children
      ? handleMandatoryCheck(prevValue, nextValue, children)
      : alwaysFalse;

    if (!isChecked) {
      return true;
    }

    const aKeys = Object.keys(prevValue);

    let i = aKeys.length;

    if (i != Object.keys(nextValue).length) {
      return true;
    }

    const getStorage = children ? children.get.bind(children) : alwaysFalse;

    while (i--) {
      const key = aKeys[i];

      if (
        !isChecked(key) &&
        processStateChanges(prevValue[key], nextValue[key], getStorage(key))
      ) {
        return true;
      }
    }

    return false;
  }

  if (Array.isArray(prevValue)) {
    const isChecked = children
      ? handleMandatoryCheck(prevValue, nextValue, children)
      : alwaysFalse;

    if (!isChecked) {
      return true;
    }

    const l = prevValue.length;

    if (l != nextValue.length) {
      return true;
    }

    const getStorage = children ? children.get.bind(children) : alwaysFalse;

    for (let i = 0; i < l; i++) {
      if (
        !isChecked(i) &&
        processStateChanges(prevValue[i], nextValue[i], getStorage(i))
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

export default processStateChanges;
