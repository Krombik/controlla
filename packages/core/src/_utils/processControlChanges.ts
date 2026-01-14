import type { PatchNode, InternalControl, ScopeCallbackMap } from '#_types';
import { addToBatch, scheduleBatch } from '#shared/batching';

const objectPrototype = Object.prototype;

const arrayPrototype = Array.prototype;

const datePrototype = Date.prototype;

const getPrototypeOf = Object.getPrototypeOf;

const handleChildren = (
  children: Map<string, ScopeCallbackMap>,
  value: any,
  isPrev: boolean
) => {
  const queue = [children, value];

  const extractFromQueue = queue.pop.bind(queue);

  const addToQueue = queue.push.bind(queue);

  while (queue.length) {
    const children: Map<string, ScopeCallbackMap> = extractFromQueue();

    const value = extractFromQueue();

    const it = children.keys();

    for (let i = children.size; i--; ) {
      const key = it.next().value;

      const childValue = value[key];

      if (childValue !== undefined) {
        const child = children.get(key)!;

        if (child._children && childValue && typeof childValue == 'object') {
          addToQueue(child._children, childValue);
        }

        if (child._callbacks) {
          addToBatch(child as InternalControl, isPrev ? childValue : undefined);
        }
      }
    }
  }
};

const handleObjectType = (
  prevValue: any,
  nextValue: any,
  control: ScopeCallbackMap | undefined,
  isCheckEverything: boolean
) => {
  const aPrototype = getPrototypeOf(prevValue);

  const children = control && control._children;

  if (aPrototype != getPrototypeOf(nextValue)) {
    if (children) {
      const it = children.keys();

      for (let i = children.size; i--; ) {
        const key = it.next().value;

        const a = prevValue[key];

        const b = nextValue[key];

        if (a !== b) {
          const isAPrimitive = a == null || typeof a != 'object';

          const isBPrimitive = b == null || typeof b != 'object';

          const child = children.get(key)!;

          if (
            isAPrimitive ||
            isBPrimitive ||
            handleObjectType(a, b, child, !!child._callbacks)
          ) {
            if (isAPrimitive != isBPrimitive && child._children) {
              handleChildren(
                child._children,
                isAPrimitive ? b : a,
                isAPrimitive
              );
            }

            if (child._callbacks) {
              addToBatch(child as InternalControl, b);
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

      if (isCheckEverything || children!.has(key)) {
        const a = prevValue[key];

        const b = nextValue[key];

        if (a !== b) {
          const isAPrimitive = a == null || typeof a != 'object';

          const isBPrimitive = b == null || typeof b != 'object';

          const child = children && children.get(key);

          if (
            isAPrimitive ||
            isBPrimitive ||
            handleObjectType(
              a,
              b,
              child,
              child && child._callbacks ? true : isCheckEverything
            )
          ) {
            if (child) {
              if (isAPrimitive != isBPrimitive && child._children) {
                handleChildren(
                  child._children,
                  isAPrimitive ? b : a,
                  isAPrimitive
                );
              }

              if (child._callbacks) {
                addToBatch(child as InternalControl, b);
              }
            }

            if (isCheckEverything) {
              if (!children) {
                return true;
              }

              isCheckEverything = false;
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

      if ((isCheckEverything || children!.has(key)) && !(key in prevValue)) {
        const b = nextValue[key];

        if (b !== undefined) {
          const child = children && children.get(key);

          if (child) {
            if (child._children && b && typeof b == 'object') {
              handleChildren(child._children, b, true);
            }

            if (child._callbacks) {
              addToBatch(child as InternalControl, b);
            }
          }

          if (isCheckEverything) {
            if (!children) {
              return true;
            }

            isCheckEverything = false;
          }

          result = true;
        }
      }
    }

    return result;
  }

  if (aPrototype == arrayPrototype) {
    const l = prevValue.length;

    if (isCheckEverything && l != nextValue.length) {
      if (!children) {
        return true;
      }

      isCheckEverything = false;
    }

    for (let i = 0; i < l; i++) {
      const key = '' + i;

      if (isCheckEverything || children!.has(key)) {
        const a = prevValue[i];

        const b = nextValue[i];

        if (a !== b) {
          const isAPrimitive = a == null || typeof a != 'object';

          const isBPrimitive = b == null || typeof b != 'object';

          const child = children && children.get(key);

          if (
            isAPrimitive ||
            isBPrimitive ||
            handleObjectType(
              a,
              b,
              child,
              child && child._callbacks ? true : isCheckEverything
            )
          ) {
            if (child) {
              if (isAPrimitive != isBPrimitive && child._children) {
                handleChildren(
                  child._children,
                  isAPrimitive ? b : a,
                  isAPrimitive
                );
              }

              if (child._callbacks) {
                addToBatch(child as InternalControl, b);
              }
            }

            if (isCheckEverything) {
              if (!children) {
                return true;
              }

              isCheckEverything = false;
            }

            result = true;
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

function kek(this: InternalControl, nextValue: any, path?: readonly string[]) {
  const l = path ? path.length : 0;

  const self = this;

  let patchNode = self._patchNode;

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
            `Cannot set properties of ${typeof value} (setting ${key})`
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

  if (self._stale) {
    self._stale = false;

    addToBatch(self);

    scheduleBatch();
  }
}

const processControlChanges = (
  prevValue: any,
  nextValue: any,
  control: ScopeCallbackMap | undefined
) => {
  if (prevValue !== nextValue) {
    const isAPrimitive = prevValue == null || typeof prevValue != 'object';

    const isBPrimitive = nextValue == null || typeof nextValue != 'object';

    if (
      isAPrimitive ||
      isBPrimitive ||
      handleObjectType(prevValue, nextValue, control, true)
    ) {
      if (isAPrimitive != isBPrimitive && control && control._children) {
        handleChildren(
          control._children,
          isAPrimitive ? nextValue : prevValue,
          isAPrimitive
        );
      }

      return true;
    }
  }

  return false;
};

export default processControlChanges;
