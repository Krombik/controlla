import noop from 'lodash.noop';
import type { State, ScopeCallbackMap } from '../../types';
import { addToBatch } from '../batching';
import processStateChanges from '../processStateChanges';

type ScopedState = State & ScopeCallbackMap;

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

export function set(
  this: ScopedState,
  nextValue: any,
  path?: readonly string[]
) {
  const self = this;

  let currentNode: ScopeCallbackMap | State | undefined = self;

  let prevValue = self._value;

  const l = path ? path.length : 0;

  const nodesQueue: State[] = [];

  const valuesArr: any[] = [];

  const pushToValuesArr = valuesArr.push.bind(valuesArr);

  const pushArr: ((value: any) => void)[] = new Array(l);

  for (let i = 0; i < l; i++) {
    const k = path![i];

    currentNode = currentNode._children && currentNode._children.get(k);

    if (currentNode) {
      if (currentNode._callbacks && currentNode._callbacks.size) {
        nodesQueue.push(currentNode as State);

        pushArr[i] = pushToValuesArr;
      } else {
        pushArr[i] = noop;
      }
    } else {
      for (; i < l; i++) {
        prevValue = prevValue ? prevValue[path![i]] : undefined;

        pushArr[i] = noop;
      }

      break;
    }

    prevValue = prevValue ? prevValue[k] : undefined;
  }

  if (processStateChanges(prevValue, nextValue, currentNode)) {
    if (path) {
      nextValue = deepSet(self._value, nextValue, path, 0, l - 1, pushArr);
    }

    self._value = nextValue;

    for (let i = nodesQueue.length; i--; ) {
      addToBatch(nodesQueue[i], valuesArr[i]);
    }

    if (self._callbacks.size) {
      addToBatch(self, nextValue);
    }
  }
}
