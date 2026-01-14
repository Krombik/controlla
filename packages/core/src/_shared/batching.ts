import type { InternalControl, PatchNode, ScopeCallbackMap } from '#_types';
import executeSetters from '#utils/executeSetters';
import processControlChanges from '#utils/processControlChanges';
import scheduleMicrotask from '#utils/scheduleMicrotask';

let batchInPending = true;

const beforeBatchCallbacks: Array<() => void> = [];

const postBatchCallbacks: Array<() => void> = [];

const batchedControls: InternalControl[] = [];

const processPatchedNode = (patchNode: PatchNode) => {
  const keys = patchNode._childrenKeys;

  const l = keys.length;

  if (l) {
    const children = patchNode._children;

    const copy = patchNode._isObject
      ? { ...patchNode._value }
      : patchNode._value.slice();

    for (let i = 0; i < l; i++) {
      const key = keys[i];

      copy[key] = processPatchedNode(children.get(key)!);
    }

    return copy;
  }

  return patchNode._value;
};

const NOT_CHANGED = {};

const handlePatchNode = (
  patchNode: PatchNode,
  control: ScopeCallbackMap | undefined
): any => {
  if (patchNode._set) {
    const nextValue = processPatchedNode(patchNode);

    if (processControlChanges(patchNode._prevValue, nextValue, control)) {
      if (control && control._callbacks.size) {
        control._valueToggler = !control._valueToggler;

        executeSetters(control._callbacks, nextValue);
      }

      return nextValue;
    }
  } else {
    const keys = patchNode._childrenKeys;

    const children = patchNode._children;

    const controlChildren = control && control._children;

    let value;

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];

      const nextValue = handlePatchNode(
        children.get(key)!,
        controlChildren && controlChildren.get(key)
      );

      if (nextValue !== NOT_CHANGED) {
        if (value) {
          value[key] = nextValue;
        } else if (patchNode._isObject) {
          value = { ...patchNode._value, [key]: nextValue };
        } else {
          value = patchNode._value.slice();

          value[key] = nextValue;
        }
      }
    }

    if (value) {
      if (control && control._callbacks.size) {
        control._valueToggler = !control._valueToggler;

        executeSetters(control._callbacks, value);
      }

      return value;
    }
  }

  return NOT_CHANGED;
};

const microtask = () => {
  for (let i = 0; i < beforeBatchCallbacks.length; i++) {
    beforeBatchCallbacks[i]();
  }

  beforeBatchCallbacks.length = 0;

  const patchesCount = batchedControls.length;

  for (let i = 0; i < patchesCount; i++) {
    const control = batchedControls[i];

    const patchNode = control._patchNode;

    const nextValue = handlePatchNode(patchNode, control);

    control._stale = true;

    if (nextValue !== NOT_CHANGED && control._callbacks.size) {
      control._valueToggler = !control._valueToggler;

      executeSetters(control._callbacks, nextValue);
    }

    if (patchNode._childrenKeys.length) {
      patchNode._childrenKeys.length = 0;

      patchNode._children.clear();
    }

    patchNode._value = control._value;

    patchNode._set = false;
  }

  batchedControls.length = 0;

  for (let i = 0; i < postBatchCallbacks.length; i++) {
    postBatchCallbacks[i]();
  }

  postBatchCallbacks.length = 0;

  batchInPending = true;

  if (beforeBatchCallbacks.length || batchedControls.length) {
    scheduleBatch();
  }
};

/** @internal */
export const scheduleBatch = () => {
  if (batchInPending) {
    batchInPending = false;

    scheduleMicrotask(microtask);
  }
};

/** @internal */
export const addToBatch = batchedControls.push.bind(batchedControls);

/** @internal */
export const beforeBatchCallbacksPush =
  beforeBatchCallbacks.push.bind(beforeBatchCallbacks);

/** @internal */
export const postBatchCallbacksPush =
  postBatchCallbacks.push.bind(postBatchCallbacks);
