import noop from 'lodash.noop';
import {
  SetData,
  State,
  StateCallbackMap,
  ValueChangeCallbacks,
} from '../../types';
import { addToBatch } from '../batching';
import processStateChanges from '../processStateChanges';

type ScopedState = State & SetData<StateCallbackMap>;

const deepSet = (
  value: any,
  nextValue: any,
  path: readonly string[],
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

  if (value != null ? !Array.isArray(value) : isNaN(+key)) {
    return value ? { ...value, [key]: nextValue } : { [key]: nextValue };
  }

  const arr = value ? value.slice() : new Array(+key + 1);

  arr[key] = nextValue;

  return arr;
};

export function _onValueChange(this: ScopedState, cb: (value: any) => void) {
  const path = this._path!;

  let length = path.length;

  let parent = this._setData;

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

export function set(this: ScopedState, nextValue: any) {
  let currentNode: StateCallbackMap | null | undefined = this._setData;

  const path = this._path!;

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

  if (processStateChanges(this.get(), nextValue, currentNode)) {
    if (l) {
      nextValue = deepSet(
        this._internal._value,
        nextValue,
        path,
        0,
        l - 1,
        pushArr
      );
    }

    this._internal._value = nextValue;

    for (let i = nodesQueue.length; i--; ) {
      addToBatch(nodesQueue[i], valuesArr[i]);
    }

    if (root) {
      addToBatch(root, nextValue);
    }
  }
}

export function get(this: ScopedState) {
  const path = this._path!;

  const l = path.length;

  let value = this._internal._value;

  for (
    let i = 0;
    i < l && (value = value ? value[path[i]] : undefined) !== undefined;
    i++
  ) {}

  return value;
}
