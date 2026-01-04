import type { InternalControl, ScopeCallbackMap } from '#_types';
import alwaysFalse from '#shared/alwaysFalse';
import { addToBatch } from '#shared/batching';

const objectPrototype = Object.prototype;

const arrayPrototype = Array.prototype;

const datePrototype = Date.prototype;

const getPrototypeOf = Object.getPrototypeOf;

const handleMandatoryCheck = (
  prevValue: any,
  nextValue: any,
  storage: Map<string, ScopeCallbackMap>
): ((key: string) => boolean) | false => {
  let equalList: Set<string> | false = new Set();

  const it = storage.keys();

  const next = it.next.bind(it);

  for (let i = storage.size; i--; ) {
    const key = next().value;

    const control = storage.get(key)!;

    const newValue = nextValue[key];

    if (processControlChanges(prevValue[key], newValue, control)) {
      equalList = false;

      if (control._callbacks) {
        addToBatch(control as InternalControl, newValue);
      }
    } else if (equalList) {
      equalList.add(key);
    }
  }

  return equalList && equalList.has.bind(equalList);
};

const handlePrevNil = (
  nextValue: any,
  storage: Map<string, ScopeCallbackMap>
) => {
  const it = storage.keys();

  const itNext = it.next.bind(it);

  for (let i = storage.size; i--; ) {
    const key = itNext().value;

    const next = nextValue[key];

    if (next !== undefined) {
      const control = storage.get(key)!;

      if (control._children && next && typeof next == 'object') {
        handlePrevNil(next, control._children);
      }

      if (control._callbacks) {
        addToBatch(control as InternalControl, next);
      }
    }
  }
};

const handleNextNil = (
  prevValue: any,
  storage: Map<string, ScopeCallbackMap>
) => {
  const it = storage.keys();

  const next = it.next.bind(it);

  for (let i = storage.size; i--; ) {
    const key = next().value;

    const prev = prevValue[key];

    if (prev !== undefined) {
      const control = storage.get(key)!;

      if (control._children && prev && typeof prev == 'object') {
        handleNextNil(prev, control._children);
      }

      if (control._callbacks) {
        addToBatch(control as InternalControl, undefined);
      }
    }
  }
};

const processControlChanges = (
  prevValue: any,
  nextValue: any,
  control: InternalControl | ScopeCallbackMap | undefined | false | null
) => {
  if (prevValue === nextValue) {
    return false;
  }

  const children = control && control._children;

  if (prevValue == null || nextValue == null) {
    if (children) {
      if (
        nextValue === undefined &&
        prevValue &&
        typeof prevValue == 'object'
      ) {
        handleNextNil(prevValue, children);
      } else if (
        prevValue === undefined &&
        nextValue &&
        typeof nextValue == 'object'
      ) {
        handlePrevNil(nextValue, children);
      }
    }

    return true;
  }

  if (typeof prevValue != 'object' && typeof nextValue != 'object') {
    return true;
  }

  const aPrototype = getPrototypeOf(prevValue);

  if (aPrototype != getPrototypeOf(nextValue)) {
    if (children) {
      handleMandatoryCheck(prevValue, nextValue, children);
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

    const l = aKeys.length;

    if (l != Object.keys(nextValue).length) {
      return true;
    }

    const getStorage = children ? children.get.bind(children) : alwaysFalse;

    for (let i = 0; i < l; i++) {
      const key = aKeys[i];

      if (
        !isChecked(key) &&
        processControlChanges(prevValue[key], nextValue[key], getStorage(key))
      ) {
        return true;
      }
    }

    return false;
  }

  if (aPrototype == arrayPrototype) {
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
      const key = '' + i;

      if (
        !isChecked(key) &&
        processControlChanges(prevValue[i], nextValue[i], getStorage(key))
      ) {
        return true;
      }
    }

    return false;
  }

  if (aPrototype == datePrototype) {
    return prevValue.getTime() != nextValue.getTime();
  }

  return true;
};

export default processControlChanges;
