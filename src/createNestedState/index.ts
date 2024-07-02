import type { CallbackSet, NestedMap, Root, NestedState } from '../types';
import { EMPTY_ARR, RootKey } from '../utils/constants';
import executeSetters from '../utils/executeSetters';
import handleNotEqual from '../utils/handleNotEqual';
import path from '../utils/path';
import safeGet from '../utils/safeGet';

const createNestedState: {
  <T>(value: T): NestedState<T>;
  <T>(getValue: () => T): NestedState<T>;
  <T>(): NestedState<T | undefined>;
} = <T>(value?: T | (() => T)) => {
  const root: Root = new Map();

  const rootMap: NestedMap = new Map();

  rootMap.set(EMPTY_ARR, new Set());

  root.set(RootKey.VALUE_GET_CALLBACK_SET, (path) => {
    const l = path.length;

    let parent = rootMap;

    for (let i = 0; i < l; i++) {
      const k = path[i];

      if (!parent.has(k)) {
        let set: CallbackSet;

        for (; i < l; i++) {
          const child: NestedMap = new Map();

          child.set(EMPTY_ARR, (set = new Set()));

          parent.set(path[i], child);

          parent = child;
        }

        return set!;
      }

      parent = parent.get(k)!;
    }

    return parent.get(EMPTY_ARR)!;
  });

  root.set(RootKey.VALUE_GET, safeGet);

  root.set(RootKey.VALUE_SET, (nextValue, rootValue, isSet, path) => {
    const l = path.length;

    const nodesQueue: NestedMap[] = [rootMap];

    let currentNode: NestedMap | false = rootMap;

    for (let i = 0; i < l; i++) {
      const k = path[i];

      if (currentNode.has(k)) {
        currentNode = currentNode.get(k)!;

        nodesQueue.push(currentNode);
      } else {
        currentNode = false;

        break;
      }
    }

    if (handleNotEqual(safeGet(rootValue, path), nextValue, currentNode)) {
      const valuesQueue: any[] = [];

      if (isSet) {
        if (l) {
          const lastIndex = l - 1;

          let newValue =
            rootValue && typeof rootValue == 'object'
              ? Array.isArray(rootValue)
                ? rootValue.slice()
                : { ...rootValue }
              : typeof path[0] == 'string'
                ? {}
                : [];

          root.set(RootKey.VALUE, newValue);

          valuesQueue.push(newValue);

          for (let i = 0; i < lastIndex; i++) {
            const key = path[i];

            const original = newValue[key];

            const copy =
              original && typeof original == 'object'
                ? Array.isArray(original)
                  ? original.slice()
                  : { ...original }
                : typeof key == 'string'
                  ? {}
                  : [];

            newValue[key] = copy;

            newValue = copy;

            valuesQueue.push(copy);
          }

          newValue[path[lastIndex]] = nextValue;
        } else {
          root.set(RootKey.VALUE, nextValue);
        }

        valuesQueue.push(nextValue);
      }

      for (let i = nodesQueue.length; i--; ) {
        executeSetters(nodesQueue[i].get(EMPTY_ARR)!, valuesQueue[i]);
      }
    }
  });

  if (typeof value == 'function') {
    value = (value as () => T)();
  }

  if (value !== undefined) {
    root.set(RootKey.VALUE, value);
  }

  return { r: root, path, _p: EMPTY_ARR };
};

export default createNestedState;
