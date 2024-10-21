import { NestedArray, NestedObject } from 'keyweaver';
import type {
  ValueChangeCallbacks,
  StateInitializer,
  StateInternalUtils,
  StateCallbackMap,
  NestedState,
} from '../types';
import { EMPTY_ARR } from '../utils/constants';
import processStateChanges from '../utils/processStateChanges';
import scope from '../utils/scope';
import noop from 'lodash.noop';
import handleState from '../utils/handleState';
import addToBatch from '../utils/batching';

interface _InternalUtils extends StateInternalUtils {
  _rootMap: StateCallbackMap;
}

const deepSet = (
  value: any,
  nextValue: any,
  path: string[],
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

  if (isNaN(+key)) {
    return value ? { ...value, [key]: nextValue } : { [key]: nextValue };
  }

  const arr = value ? value.slice() : new Array(+key + 1);

  arr[key] = nextValue;

  return arr;
};

function _onValueChange(
  this: _InternalUtils,
  cb: (value: any) => void,
  path: string[]
) {
  let length = path.length;

  let parent = this._rootMap;

  let set: ValueChangeCallbacks | undefined;

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
          const children = parent._children;

          if (children && children.size != 1) {
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

function _set(this: _InternalUtils, nextValue: any, path: string[]) {
  let currentNode: StateCallbackMap | null | undefined = this._rootMap;

  const root = currentNode._root;

  const l = path.length;

  const nodesQueue: ValueChangeCallbacks[] = [];

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

  if (processStateChanges(this._get(path), nextValue, currentNode)) {
    if (l) {
      nextValue = deepSet(this._value, nextValue, path, 0, l - 1, pushArr);
    }

    this._value = nextValue;

    for (let i = nodesQueue.length; i--; ) {
      addToBatch(nodesQueue[i], valuesArr[i]);
    }

    if (root) {
      addToBatch(root, nextValue);
    }
  }
}

function _get(this: _InternalUtils, path: string[]) {
  const l = path.length;

  let value = this._value;

  for (
    let i = 0;
    i < l && (value = value ? value[path[i]] : undefined) !== undefined;
    i++
  ) {}

  return value;
}

/** Creates a nested state for managing complex state. */
const createNestedState: {
  <T extends NestedArray | NestedObject>(): NestedState<T | undefined>;
  <T extends NestedArray | NestedObject>(
    value: T | (() => T),
    stateInitializer?: StateInitializer<T>
  ): NestedState<T>;
} = (
  value?: unknown | (() => unknown),
  stateInitializer?: StateInitializer,
  keys?: any[],
  utils?: Record<string, any>
) => {
  utils = {
    _value: undefined,
    _data: undefined!,
    _rootMap: { _root: null, _children: null },
    _onValueChange,
    _get,
    _set,
    ...utils,
  } as _InternalUtils;

  return {
    _internal: utils as _InternalUtils,
    _path: EMPTY_ARR,
    scope,
    _anchor: handleState(
      value,
      stateInitializer,
      keys,
      utils as _InternalUtils
    ),
  } as Partial<NestedState<any>> as NestedState<any>;
};

export type { NestedState };

export default createNestedState;
