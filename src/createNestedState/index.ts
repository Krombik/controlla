import { NestedArray, NestedObject } from 'keyweaver';
import type {
  CallbackRegistry,
  InitModule,
  InternalUtils,
  Key,
  NestedMap,
  NestedState,
} from '../types';
import { EMPTY_ARR, RootKey } from '../utils/constants';
import executeSetters from '../utils/executeSetters';
import handleNotEqual from '../utils/handleNotEqual';
import path from '../utils/path';
import safeGet from '../utils/safeGet';
import noop from 'lodash.noop';
import handleState from '../utils/handleState';

interface _InternalUtils extends InternalUtils {
  _rootMap: NestedMap;
}

const deepSet = (
  value: any,
  nextValue: any,
  path: Key[],
  index: number,
  lastIndex: number,
  pushValueArr: ((value: any) => void)[]
): any => {
  const key = path[index];

  if (value != null && typeof value != 'object') {
    value = null;
  }

  if (index < lastIndex) {
    nextValue = deepSet(
      value && value[key],
      nextValue,
      path,
      index + 1,
      lastIndex,
      pushValueArr
    );
  }

  pushValueArr[index](nextValue);

  if (typeof key == 'string') {
    return value ? { ...value, [key]: nextValue } : { [key]: nextValue };
  }

  const arr = value ? value.slice() : new Array(key + 1);

  arr[key] = nextValue;

  return arr;
};

function _onValueChange(
  this: _InternalUtils,
  cb: (value: any) => void,
  path: Key[]
) {
  let length = path.length;

  let parent = this._rootMap;

  let set: CallbackRegistry | undefined;

  for (let i = 0, l = length; i < l; i++) {
    if (parent._children) {
      let child = parent._children.get(path[i]);

      if (child) {
        parent = child;

        continue;
      }
    } else {
      parent._children = new Map();
    }

    let children = parent._children;

    for (l--; i < l; i++) {
      children.set(
        path[i],
        (parent = {
          _root: null,
          _children: (children = new Map()),
          _parent: parent,
        })
      );
    }

    children.set(
      path[l],
      (parent = { _root: (set = new Set()), _children: null, _parent: parent })
    );
  }

  if (!set) {
    if (parent._root) {
      set = parent._root;
    } else {
      parent._root = set = new Set();
    }
  }

  set.add(cb);

  return () => {
    if (set.delete(cb) && !set.size) {
      parent._root = null;

      if (!parent._children) {
        for (parent = parent._parent!; length--; parent = parent._parent!) {
          const children = parent._children!;

          if (children.size != 1) {
            children.delete(path[length]);
          } else {
            parent._children = null;
          }

          if (parent._root) {
            break;
          }
        }
      }
    }
  };
}

function _set(
  this: _InternalUtils,
  nextValue: any,
  isSet: boolean,
  path: Key[]
) {
  let currentNode: NestedMap | null | undefined = this._rootMap;

  const root = currentNode._root;

  const data = this._data;

  const rootValue = data.get(RootKey.VALUE);

  const l = path.length;

  const nodesQueue: CallbackRegistry[] = [];

  const valuesArr: any[] = [];

  const pushToValuesArr = valuesArr.push.bind(valuesArr);

  const pushArr: ((value: any) => void)[] = [];

  for (let i = 0; i < l; i++) {
    const k = path[i];

    currentNode = currentNode._children && currentNode._children.get(k);

    if (currentNode) {
      if (currentNode._root) {
        nodesQueue.push(currentNode._root);

        pushArr.push(pushToValuesArr);
      } else {
        pushArr.push(noop);
      }
    } else {
      for (; i < l; i++) {
        pushArr.push(noop);
      }

      break;
    }
  }

  if (handleNotEqual(safeGet(rootValue, path), nextValue, currentNode)) {
    if (isSet) {
      if (l) {
        nextValue = deepSet(rootValue, nextValue, path, 0, l - 1, pushArr);
      }

      data.set(RootKey.VALUE, nextValue);
    }

    for (let i = nodesQueue.length; i--; ) {
      executeSetters(nodesQueue[i], valuesArr[i]);
    }

    if (root) {
      executeSetters(root, nextValue);
    }
  }
}

const createNestedState: {
  <T extends NestedArray | NestedObject>(): NestedState<T | undefined>;
  <T extends NestedArray | NestedObject>(
    value: T | (() => T),
    initModule?: InitModule<T>
  ): NestedState<T>;
} = (
  value?: unknown | (() => unknown),
  initModule?: InitModule,
  keys?: any[],
  utils?: Record<string, any>
) => {
  utils = {
    _data: undefined!,
    _rootMap: { _root: null, _children: null },
    _onValueChange,
    _get: safeGet,
    _set,
    ...utils,
  } as _InternalUtils;

  return {
    _internal: utils as _InternalUtils,
    _path: EMPTY_ARR,
    path,
    _anchor: handleState(value, initModule, keys, utils as _InternalUtils),
  } as Partial<NestedState<any>> as NestedState<any>;
};

export default createNestedState;
