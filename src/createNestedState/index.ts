import { NestedArray, NestedObject } from 'keyweaver';
import type {
  CallbackRegistry,
  InternalDataMap,
  InternalUtils,
  Key,
  NestedMap,
  NestedState,
  OriginalStateCreator,
  StateType,
} from '../types';
import { EMPTY_ARR, RootKey } from '../utils/constants';
import executeSetters from '../utils/executeSetters';
import handleNotEqual from '../utils/handleNotEqual';
import path from '../utils/path';
import safeGet from '../utils/safeGet';

interface _InternalUtils extends InternalUtils {
  _rootMap: NestedMap;
}

function _getValueChangeCallbackSet(this: _InternalUtils, path: Key[]) {
  const l = path.length;

  let parent = this._rootMap;

  for (let i = 0; i < l; i++) {
    const k = path[i];

    if (!parent.has(k)) {
      let set: CallbackRegistry;

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
}

function _set(
  this: _InternalUtils,
  nextValue: any,
  isSet: boolean,
  path: Key[]
) {
  let currentNode: NestedMap | false = this._rootMap;

  const data = this._data;

  const rootValue = data.get(RootKey.VALUE);

  const l = path.length;

  const nodesQueue: NestedMap[] = [currentNode];

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

        data.set(RootKey.VALUE, newValue);

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
        data.set(RootKey.VALUE, nextValue);
      }

      valuesQueue.push(nextValue);
    }

    for (let i = nodesQueue.length; i--; ) {
      executeSetters(nodesQueue[i].get(EMPTY_ARR)!, valuesQueue[i]);
    }
  }
}

const createNestedState = <T extends NestedArray | NestedObject>(
  value?: T | (() => T)
): NestedState<T> => {
  const data: InternalDataMap = new Map();

  const rootMap: NestedMap = new Map();

  rootMap.set(EMPTY_ARR, new Set());

  if (typeof value == 'function') {
    value = value();
  }

  if (value !== undefined) {
    data.set(RootKey.VALUE, value);
  }

  return {
    _internal: {
      _data: data,
      _rootMap: rootMap,
      _getValueChangeCallbackSet,
      _get: safeGet,
      _set,
    } as _InternalUtils,
    _path: EMPTY_ARR,
    path,
  } as Partial<NestedState<any>> as NestedState<T>;
};

export default createNestedState as OriginalStateCreator<
  typeof createNestedState,
  StateType.STATE
>;
