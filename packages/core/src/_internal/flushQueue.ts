import type {
  ControlNode,
  RootControlNode,
  EnqueueablePrimitiveControlInternals,
  ChangeListener,
  PatchTreeNode,
} from '#internal/types';
import alwaysNoop from '#shared-internal/alwaysNoop';
import scheduleMicrotask from '#internal/scheduleMicrotask';

let canScheduleFlush = true;

let canMutateNow = true;

let canMutateDerivedControls = true;

const beforeFlushHooks: Array<() => void> = [];

const afterFlushHooks: Array<() => void> = [];

const pendingControls: RootControlNode[] = [];

const pendingDerivedControls: RootControlNode[] = [];

const pendingPrimitiveControls: EnqueueablePrimitiveControlInternals[] = [];

const objectPrototype = Object.prototype;

const arrayPrototype = Array.prototype;

const datePrototype = Date.prototype;

const getPrototypeOf = Object.getPrototypeOf;

const notifyDescendants = (
  children: Map<string, ControlNode>,
  source: any,
  emitSourceValues: boolean
) => {
  const queue = [children, source];

  const extractFromQueue = queue.pop.bind(queue);

  const addToQueue = queue.push.bind(queue);

  while (queue.length) {
    const children: Map<string, ControlNode> = extractFromQueue();

    const value = extractFromQueue();

    const it = children.keys();

    for (let i = children.size; i--; ) {
      const key = it.next().value;

      const childValue = value[key];

      if (childValue !== undefined) {
        const child = children.get(key)!;

        const callbacks = child._listeners;

        const l = callbacks.length;

        if (l) {
          const next = emitSourceValues ? childValue : undefined;

          const prev = emitSourceValues ? undefined : childValue;

          child._versionToggle = !child._versionToggle;

          for (let i = 0; i < l; i++) {
            callbacks[i](next, prev);
          }
        }

        if (child._children && childValue && typeof childValue == 'object') {
          addToQueue(child._children, childValue);
        }
      }
    }
  }
};

const compareAndNotify = (
  prevValue: any,
  nextValue: any,
  children: Map<string, ControlNode> | undefined,
  scanUntilMismatch: boolean
) => {
  const aPrototype = getPrototypeOf(prevValue);

  if (aPrototype != getPrototypeOf(nextValue)) {
    if (children) {
      const it = children.keys();

      for (let i = children.size; i--; ) {
        const key = it.next().value;

        const child = children.get(key)!;

        const callbacks = child._listeners;

        const l = callbacks.length;

        const grandchildren = child._children;

        if (l || grandchildren) {
          const a = prevValue[key];

          const b = nextValue[key];

          if (a !== b) {
            const isAPrimitive = a == null || typeof a != 'object';

            const isBPrimitive = b == null || typeof b != 'object';

            if (
              isAPrimitive ||
              isBPrimitive ||
              compareAndNotify(a, b, grandchildren, !!l)
            ) {
              if (isAPrimitive != isBPrimitive && grandchildren) {
                notifyDescendants(
                  grandchildren,
                  isAPrimitive ? b : a,
                  isAPrimitive
                );
              }

              if (l) {
                child._versionToggle = !child._versionToggle;

                for (let i = 0; i < l; i++) {
                  callbacks[i](b, a);
                }
              }
            }
          }
        }
      }
    }

    return true;
  }

  let result = false;

  if (aPrototype == objectPrototype) {
    const aKeys = Object.keys(prevValue);

    const aL = aKeys.length;

    for (let i = 0; i < aL; i++) {
      const key = aKeys[i];

      const child = children && children.get(key);

      const callbacks = child && child._listeners;

      const l = callbacks && callbacks.length;

      const grandchildren = child && child._children;

      if (scanUntilMismatch || l || grandchildren) {
        const a = prevValue[key];

        const b = nextValue[key];

        if (a !== b) {
          const isAPrimitive = a == null || typeof a != 'object';

          const isBPrimitive = b == null || typeof b != 'object';

          if (
            isAPrimitive ||
            isBPrimitive ||
            compareAndNotify(a, b, grandchildren, !!l || scanUntilMismatch)
          ) {
            if (scanUntilMismatch) {
              if (!children) {
                return true;
              }

              scanUntilMismatch = false;
            }

            if (isAPrimitive != isBPrimitive && grandchildren) {
              notifyDescendants(
                grandchildren,
                isAPrimitive ? b : a,
                isAPrimitive
              );
            }

            if (l) {
              child._versionToggle = !child._versionToggle;

              for (let i = 0; i < l; i++) {
                callbacks[i](b, a);
              }
            }

            result = true;
          }
        }
      }
    }

    const bKeys = Object.keys(nextValue);

    const bL = bKeys.length;

    for (let i = 0; i < bL; i++) {
      const key = bKeys[i];

      if (!(key in prevValue)) {
        const child = children && children.get(key);

        const callbacks = child && child._listeners;

        const l = callbacks && callbacks.length;

        const grandchildren = child && child._children;

        if (scanUntilMismatch || l || grandchildren) {
          const b = nextValue[key];

          if (b !== undefined) {
            if (scanUntilMismatch) {
              if (!children) {
                return true;
              }

              scanUntilMismatch = false;
            }

            if (grandchildren && b && typeof b == 'object') {
              notifyDescendants(grandchildren, b, true);
            }

            if (l) {
              child._versionToggle = !child._versionToggle;

              for (let i = 0; i < l; i++) {
                callbacks[i](b, undefined);
              }
            }

            result = true;
          }
        }
      }
    }

    return result;
  }

  if (aPrototype == arrayPrototype) {
    const lPrev = prevValue.length;

    const lNext = nextValue.length;

    if (scanUntilMismatch && lPrev != lNext) {
      if (!children) {
        return true;
      }

      scanUntilMismatch = false;
    }

    for (let i = 0; i < lNext; i++) {
      const key = '' + i;

      const child = children && children.get(key);

      const callbacks = child && child._listeners;

      const l = callbacks && callbacks.length;

      const grandchildren = child && child._children;

      if (scanUntilMismatch || l || grandchildren) {
        const a = prevValue[i];

        const b = nextValue[i];

        if (a !== b) {
          const isAPrimitive = a == null || typeof a != 'object';

          const isBPrimitive = b == null || typeof b != 'object';

          if (
            isAPrimitive ||
            isBPrimitive ||
            compareAndNotify(a, b, grandchildren, !!l || scanUntilMismatch)
          ) {
            if (scanUntilMismatch) {
              if (!children) {
                return true;
              }

              scanUntilMismatch = false;
            }

            if (isAPrimitive != isBPrimitive && grandchildren) {
              notifyDescendants(
                grandchildren,
                isAPrimitive ? b : a,
                isAPrimitive
              );
            }

            if (l) {
              child._versionToggle = !child._versionToggle;

              for (let i = 0; i < l; i++) {
                callbacks[i](b, a);
              }
            }

            result = true;
          }
        }
      }
    }

    for (let i = lNext; i < lPrev; i++) {
      const a = prevValue[i];

      if (a !== undefined) {
        const child = children!.get('' + i);

        if (child) {
          if (child._children && a && typeof a == 'object') {
            notifyDescendants(child._children, a, false);
          }

          const callbacks = child._listeners;

          const l = callbacks.length;

          if (l) {
            child._versionToggle = !child._versionToggle;

            for (let i = 0; i < l; i++) {
              callbacks[i](undefined, a);
            }
          }
        }
      }
    }

    return result;
  }

  return (
    aPrototype != datePrototype || prevValue.getTime() != nextValue.getTime()
  );
};

const buildPatchedValue = (patchNode: PatchTreeNode) => {
  const keys = patchNode._patchedKeys;

  const l = keys.length;

  if (l) {
    const children = patchNode._children;

    const copy = patchNode._isObject
      ? { ...patchNode._value }
      : patchNode._value.slice();

    for (let i = 0; i < l; i++) {
      const key = keys[i];

      copy[key] = buildPatchedValue(children.get(key)!);
    }

    return copy;
  }

  return patchNode._value;
};

const UNCHANGED = Symbol();

const commitPatchNode = (
  patchNode: PatchTreeNode,
  control: ControlNode | undefined
): any => {
  if (patchNode._hasValuePatch) {
    const prevValue = patchNode._prevValue;

    const nextValue = buildPatchedValue(patchNode);

    if (prevValue !== nextValue) {
      const isAPrimitive = prevValue == null || typeof prevValue != 'object';

      const isBPrimitive = nextValue == null || typeof nextValue != 'object';

      const children = control && control._children;

      if (
        isAPrimitive ||
        isBPrimitive ||
        compareAndNotify(prevValue, nextValue, children, true)
      ) {
        if (isAPrimitive != isBPrimitive && children) {
          notifyDescendants(
            children,
            isAPrimitive ? nextValue : prevValue,
            isAPrimitive
          );
        }

        return nextValue;
      }
    }
  } else {
    const keys = patchNode._patchedKeys;

    const children = patchNode._children;

    const prevValue = patchNode._value;

    const controlChildren = control && control._children;

    let value;

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];

      const nextValue = commitPatchNode(
        children.get(key)!,
        controlChildren && controlChildren.get(key)
      );

      if (nextValue !== UNCHANGED) {
        if (value) {
          value[key] = nextValue;
        } else if (patchNode._isObject) {
          value = { ...prevValue, [key]: nextValue };
        } else {
          value = prevValue.slice();

          value[key] = nextValue;
        }
      }
    }

    if (value) {
      if (control) {
        const callbacks = control._listeners;

        const l = callbacks.length;

        if (l) {
          control._versionToggle = !control._versionToggle;

          for (let i = 0; i < l; i++) {
            callbacks[i](value, prevValue);
          }
        }
      }

      return value;
    }
  }

  return UNCHANGED;
};

const handleControls = (controls: RootControlNode[]) => {
  for (let i = 0; i < controls.length; i++) {
    const control = controls[i];

    const patchNode = control._patchNode;

    const prevValue = control._value;

    const nextValue = commitPatchNode(patchNode, control);

    control._stale = true;

    patchNode._hasValuePatch = false;

    if (patchNode._patchedKeys.length) {
      patchNode._patchedKeys.length = 0;

      patchNode._children.clear();
    }

    if (nextValue !== UNCHANGED) {
      control._value = nextValue;

      patchNode._value = nextValue;

      patchNode._prevValue = nextValue;

      const callbacks = control._listeners;

      const l = callbacks.length;

      if (l) {
        control._versionToggle = !control._versionToggle;

        for (let i = 0; i < l; i++) {
          callbacks[i](nextValue, prevValue);
        }
      }
    } else {
      patchNode._value = prevValue;
    }
  }

  controls.length = 0;
};

const flushBatch = () => {
  for (let i = 0; i < beforeFlushHooks.length; i++) {
    beforeFlushHooks[i]();
  }

  beforeFlushHooks.length = 0;

  canMutateNow = false;

  handleControls(pendingControls);

  for (let i = 0; i < pendingPrimitiveControls.length; i++) {
    const control = pendingPrimitiveControls[i];

    const prevValue = control._value;

    const nextValue = control._nextValue;

    control._stale = true;

    control._nextValue = undefined;

    if (nextValue !== prevValue) {
      control._value = nextValue;

      const callbacks = control._listeners;

      const l = callbacks.length;

      if (l) {
        control._versionToggle = !control._versionToggle;

        for (let i = 0; i < l; i++) {
          callbacks[i](nextValue, prevValue);
        }
      }
    }
  }

  pendingPrimitiveControls.length = 0;

  canMutateNow = true;

  for (let i = 0; i < afterFlushHooks.length; i++) {
    afterFlushHooks[i]();
  }

  afterFlushHooks.length = 0;

  canMutateDerivedControls = false;

  handleControls(pendingDerivedControls);

  canMutateDerivedControls = true;

  canScheduleFlush = true;

  if (beforeFlushHooks.length || pendingControls.length) {
    scheduleFlush();
  }
};

export const scheduleFlush = () => {
  if (canScheduleFlush) {
    canScheduleFlush = false;

    scheduleMicrotask(flushBatch);
  }
};

const enqueueControl = pendingControls.push.bind(pendingControls);

const enqueueDerivedControl = pendingDerivedControls.push.bind(
  pendingDerivedControls
);

const enqueuePrimitiveControl = pendingPrimitiveControls.push.bind(
  pendingPrimitiveControls
);

export const addBeforeFlushHook = beforeFlushHooks.push.bind(beforeFlushHooks);

export const addAfterFlushHook = afterFlushHooks.push.bind(afterFlushHooks);

export const enqueuePrimitiveSet = (
  control: EnqueueablePrimitiveControlInternals,
  nextValue: any
) => {
  if (canMutateNow) {
    control._nextValue = nextValue;

    if (control._stale) {
      control._stale = false;

      enqueuePrimitiveControl(control);

      scheduleFlush();
    }
  } else {
    addAfterFlushHook(() => {
      enqueuePrimitiveSet(control, nextValue);
    });
  }
};

const handleEnqueueSet = (
  enqueueControl: (value: RootControlNode) => any,
  control: RootControlNode,
  nextValue: any,
  path?: readonly string[]
) => {
  const l = path ? path.length : 0;

  let patchNode = control._patchNode;

  for (let i = 0; i < l; i++) {
    const key = path![i];

    if (!patchNode._children.has(key)) {
      for (; i < l; i++) {
        const key = path![i];

        const value = patchNode._value;

        const proto = value != null && getPrototypeOf(value);

        const isObject = proto == objectPrototype;

        if (isObject || proto == arrayPrototype) {
          const nextPatchNode: PatchTreeNode = {
            _value: value[key],
            _prevValue: undefined,
            _isObject: true,
            _children: new Map(),
            _patchedKeys: [],
            _hasValuePatch: false,
          };

          patchNode._children.set(key, nextPatchNode);

          patchNode._patchedKeys.push(key);

          patchNode._isObject = isObject;

          patchNode = nextPatchNode;
        } else {
          throw new Error(
            `Cannot set properties of ${value !== null ? typeof value : 'null'} (setting ${key})`
          );
        }
      }

      patchNode._prevValue = patchNode._value;

      break;
    }

    patchNode = patchNode._children.get(key)!;
  }

  if (patchNode._patchedKeys.length) {
    patchNode._patchedKeys.length = 0;

    patchNode._children.clear();
  }

  patchNode._value = nextValue;

  patchNode._hasValuePatch = true;

  if (control._stale) {
    control._stale = false;

    enqueueControl(control);

    scheduleFlush();
  }
};

export const enqueueSet = (
  control: RootControlNode,
  nextValue: any,
  path?: readonly string[]
) => {
  if (canMutateNow) {
    handleEnqueueSet(enqueueControl, control, nextValue, path);
  } else {
    addAfterFlushHook(() => {
      handleEnqueueSet(enqueueControl, control, nextValue, path);
    });
  }
};

export function enqueueDerivedSet(
  this: RootControlNode,
  nextValue: any,
  path?: readonly string[]
) {
  if (canMutateDerivedControls) {
    handleEnqueueSet(enqueueDerivedControl, this, nextValue, path);
  } else {
    addBeforeFlushHook(() => {
      handleEnqueueSet(enqueueDerivedControl, this, nextValue, path);
    });
  }
}

const addUniqueListener = (
  indexMap: Map<ChangeListener, number>,
  callbacks: ChangeListener[],
  cb: ChangeListener
) => {
  if (!indexMap.has(cb)) {
    indexMap.set(cb, callbacks.length);

    callbacks.push(cb);
  }
};

const removeListener = (
  indexMap: Map<ChangeListener, number>,
  callbacks: ChangeListener[],
  cb: ChangeListener
) => {
  if (indexMap.has(cb)) {
    const last = callbacks.pop()!;

    if (last != cb) {
      const index = indexMap.get(cb)!;

      callbacks[index] = last;

      indexMap.set(last, index)!;
    }

    indexMap.delete(cb);
  }
};

export const createSubscriber = (
  callbacks: ChangeListener[],
  loadOrNoop: () => () => void
) => {
  const indexMap = new Map<ChangeListener, number>();

  return (cb: ChangeListener, withoutLoad?: boolean) => {
    const unload = (withoutLoad ? alwaysNoop : loadOrNoop)();

    if (canMutateNow) {
      addUniqueListener(indexMap, callbacks, cb);
    } else {
      addAfterFlushHook(() => {
        addUniqueListener(indexMap, callbacks, cb);
      });
    }

    return () => {
      unload();

      if (canMutateNow) {
        removeListener(indexMap, callbacks, cb);
      } else {
        addAfterFlushHook(() => {
          removeListener(indexMap, callbacks, cb);
        });
      }
    };
  };
};
