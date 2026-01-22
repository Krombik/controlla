import type {
  ControlBase,
  ControlRoot,
  EnqueueblePrimitive,
  OnValueChange,
  PatchNode,
} from '#_types';
import alwaysNoop from '#shared/alwaysNoop';
import scheduleMicrotask from '#utils/scheduleMicrotask';

let canScheduleFlush = true;

let canMutateNow = true;

const beforeFlushHooks: Array<() => void> = [];

const afterFlushHooks: Array<() => void> = [];

const pendingControls: ControlRoot[] = [];

const pendingPrimitiveControls: EnqueueblePrimitive[] = [];

const objectPrototype = Object.prototype;

const arrayPrototype = Array.prototype;

const datePrototype = Date.prototype;

const getPrototypeOf = Object.getPrototypeOf;

const notifyDescendants = (
  children: Map<string, ControlBase>,
  source: any,
  emitSourceValues: boolean
) => {
  const queue = [children, source];

  const extractFromQueue = queue.pop.bind(queue);

  const addToQueue = queue.push.bind(queue);

  while (queue.length) {
    const children: Map<string, ControlBase> = extractFromQueue();

    const value = extractFromQueue();

    const it = children.keys();

    for (let i = children.size; i--; ) {
      const key = it.next().value;

      const childValue = value[key];

      if (childValue !== undefined) {
        const child = children.get(key)!;

        const callbacks = child._callbacks;

        const l = callbacks.length;

        if (l) {
          const next = emitSourceValues ? childValue : undefined;

          const prev = emitSourceValues ? undefined : childValue;

          child._valueToggler = !child._valueToggler;

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
  children: Map<string, ControlBase> | undefined,
  scanUntilMismatch: boolean
) => {
  const aPrototype = getPrototypeOf(prevValue);

  if (aPrototype != getPrototypeOf(nextValue)) {
    if (children) {
      const it = children.keys();

      for (let i = children.size; i--; ) {
        const key = it.next().value;

        const child = children.get(key)!;

        const callbacks = child._callbacks;

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
                child._valueToggler = !child._valueToggler;

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

      const callbacks = child && child._callbacks;

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
              child._valueToggler = !child._valueToggler;

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

        const callbacks = child && child._callbacks;

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
              child._valueToggler = !child._valueToggler;

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

      const callbacks = child && child._callbacks;

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
              child._valueToggler = !child._valueToggler;

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

          const callbacks = child._callbacks;

          const l = callbacks.length;

          if (l) {
            child._valueToggler = !child._valueToggler;

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

const buildPatchedValue = (patchNode: PatchNode) => {
  const keys = patchNode._childrenKeys;

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
  patchNode: PatchNode,
  control: ControlBase | undefined
): any => {
  if (patchNode._set) {
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
    const keys = patchNode._childrenKeys;

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
        const callbacks = control._callbacks;

        const l = callbacks.length;

        if (l) {
          control._valueToggler = !control._valueToggler;

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

const flushBatch = () => {
  for (let i = 0; i < beforeFlushHooks.length; i++) {
    beforeFlushHooks[i]();
  }

  beforeFlushHooks.length = 0;

  canMutateNow = false;

  for (let i = 0; i < pendingControls.length; i++) {
    const control = pendingControls[i];

    const patchNode = control._patchNode;

    const prevValue = control._value;

    const nextValue = commitPatchNode(patchNode, control);

    control._stale = true;

    patchNode._set = false;

    if (patchNode._childrenKeys.length) {
      patchNode._childrenKeys.length = 0;

      patchNode._children.clear();
    }

    if (nextValue !== UNCHANGED) {
      control._value = nextValue;

      patchNode._value = nextValue;

      patchNode._prevValue = nextValue;

      const callbacks = control._callbacks;

      const l = callbacks.length;

      if (l) {
        control._valueToggler = !control._valueToggler;

        for (let i = 0; i < l; i++) {
          callbacks[i](nextValue, prevValue);
        }
      }
    } else {
      patchNode._value = prevValue;
    }
  }

  pendingControls.length = 0;

  for (let i = 0; i < pendingPrimitiveControls.length; i++) {
    const control = pendingPrimitiveControls[i];

    const prevValue = control._value;

    const nextValue = control._nextValue;

    control._stale = true;

    control._nextValue = undefined;

    if (nextValue !== prevValue) {
      control._value = nextValue;

      const callbacks = control._callbacks;

      const l = callbacks.length;

      if (l) {
        control._valueToggler = !control._valueToggler;

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

const enqueuePrimitiveControl = pendingPrimitiveControls.push.bind(
  pendingPrimitiveControls
);

export const addBeforeFlushHook = beforeFlushHooks.push.bind(beforeFlushHooks);

export const addAfterFlushHook = afterFlushHooks.push.bind(afterFlushHooks);

export const enqueuePrimitiveSet = (
  control: EnqueueblePrimitive,
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

export const enqueueSet = (
  control: ControlRoot,
  nextValue: any,
  path?: readonly string[]
) => {
  if (canMutateNow) {
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
            const nextPatchNode: PatchNode = {
              _value: value[key],
              _prevValue: undefined,
              _isObject: true,
              _children: new Map(),
              _childrenKeys: [],
              _set: false,
            };

            patchNode._children.set(key, nextPatchNode);

            patchNode._childrenKeys.push(key);

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

    if (patchNode._childrenKeys.length) {
      patchNode._childrenKeys.length = 0;

      patchNode._children.clear();
    }

    patchNode._value = nextValue;

    patchNode._set = true;

    if (control._stale) {
      control._stale = false;

      enqueueControl(control);

      scheduleFlush();
    }
  } else {
    addAfterFlushHook(() => {
      enqueueSet(control, nextValue, path);
    });
  }
};

const addUniqueListener = (
  indexMap: Map<OnValueChange, number>,
  callbacks: OnValueChange[],
  cb: OnValueChange
) => {
  if (!indexMap.has(cb)) {
    indexMap.set(cb, callbacks.length);

    callbacks.push(cb);
  }
};

const removeListener = (
  indexMap: Map<OnValueChange, number>,
  callbacks: OnValueChange[],
  cb: OnValueChange
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
  callbacks: OnValueChange[],
  loadOrNoop: () => () => void
) => {
  const indexMap = new Map<OnValueChange, number>();

  return (cb: OnValueChange, withoutLoad?: boolean) => {
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
