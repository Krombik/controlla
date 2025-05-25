import noop from 'lodash.noop';
import type { ScopeCallbackMap, InternalState } from '../../types';
import { addToBatch } from '../batching';
import processStateChanges from '../processStateChanges';

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

  const arr = value ? value.slice() : Array(+key + 1);

  arr[key] = nextValue;

  return arr;
};

export function set(
  this: InternalState,
  nextValue: any,
  path?: readonly string[]
) {
  const self = this;

  const l = path ? path.length : 0;

  const nodesQueue: InternalState[] = [];

  const valuesArr: any[] = [];

  const pushToValuesArr = valuesArr.push.bind(valuesArr);

  const pushArr: ((value: any) => void)[] = Array(l);

  let prevValue = self._value;

  let currentNode: ScopeCallbackMap | InternalState = self;

  for (let i = 0; i < l; i++) {
    const key = path![i];

    currentNode = currentNode._children!.get(key)!;

    if (currentNode._callbacks) {
      nodesQueue.push(currentNode as InternalState);

      pushArr[i] = pushToValuesArr;
    } else {
      pushArr[i] = noop;
    }

    prevValue = prevValue ? prevValue[key] : undefined;
  }

  if (processStateChanges(prevValue, nextValue, currentNode)) {
    if (l) {
      nextValue = deepSet(self._value, nextValue, path!, 0, l - 1, pushArr);

      for (let i = nodesQueue.length; i--; ) {
        addToBatch(nodesQueue[i], valuesArr[i]);
      }
    }

    addToBatch(self, nextValue);

    self._value = nextValue;
  }
}
