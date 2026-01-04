import noop from 'lodash.noop';
import type { ScopeCallbackMap, InternalControl } from '#_types';
import { addToBatch } from '#shared/batching';
import processControlChanges from '#utils/processControlChanges';

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
  this: InternalControl,
  nextValue: any,
  path?: readonly string[]
) {
  const self = this;

  const l = path ? path.length : 0;

  const nodesQueue: InternalControl[] = [];

  const valuesArr: any[] = [];

  const pushToValuesArr = valuesArr.push.bind(valuesArr);

  const pushArr: ((value: any) => void)[] = Array(l);

  let prevValue = self._value;

  let currentNode: ScopeCallbackMap | InternalControl = self;

  for (let i = 0; i < l; i++) {
    const key = path![i];

    currentNode = currentNode._children!.get(key)!;

    if (currentNode._callbacks) {
      nodesQueue.push(currentNode as InternalControl);

      pushArr[i] = pushToValuesArr;
    } else {
      pushArr[i] = noop;
    }

    prevValue = prevValue ? prevValue[key] : undefined;
  }

  if (processControlChanges(prevValue, nextValue, currentNode)) {
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
