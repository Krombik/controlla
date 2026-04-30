import notify from '#internal/notify';
import type {
  PatchTreeNode,
  Lane,
  ControlInternalsChild,
} from '#internal/types';

export const UNCHANGED = Symbol();

const objectPrototype = Object.prototype;

const arrayPrototype = Array.prototype;

const datePrototype = Date.prototype;

const getPrototypeOf = Object.getPrototypeOf;

const isArray = Array.isArray;

const notifyDescendants = (
  children: Map<string, ControlInternalsChild>,
  source: any,
  emitSourceValues: boolean,
  lane: Lane
) => {
  const queue = [children, source];

  do {
    const children: Map<string, ControlInternalsChild> = queue.pop();

    const value = queue.pop();

    const it = children.keys();

    for (let i = children.size; i--; ) {
      const key = it.next().value!;

      const childValue = value[key];

      if (childValue !== undefined) {
        const child = children.get(key)!;

        notify(
          child._listeners,
          child._dependents,
          lane,
          emitSourceValues ? childValue : undefined,
          emitSourceValues ? undefined : childValue
        );

        if (child._children && childValue && typeof childValue == 'object') {
          queue.push(child._children, childValue);
        }
      }
    }
  } while (queue.length);
};

const compareAndNotify = (
  prevValue: any,
  nextValue: any,
  children: Map<string, ControlInternalsChild> | undefined,
  scanUntilMismatch: boolean,
  lane: Lane
) => {
  const aPrototype = getPrototypeOf(prevValue);

  if (aPrototype != getPrototypeOf(nextValue)) {
    if (children) {
      const it = children.keys();

      for (let i = children.size; i--; ) {
        const key = it.next().value!;

        const child = children.get(key)!;

        const listeners = child._listeners;

        const dependents = child._dependents;

        const isListened = !!listeners.length || !!dependents.length;

        const grandchildren = child._children;

        if (isListened || grandchildren) {
          const a = prevValue[key];

          const b = nextValue[key];

          if (a !== b) {
            const isAPrimitive = a == null || typeof a != 'object';

            const isBPrimitive = b == null || typeof b != 'object';

            if (
              isAPrimitive ||
              isBPrimitive ||
              compareAndNotify(a, b, grandchildren, isListened, lane)
            ) {
              if (isAPrimitive != isBPrimitive && grandchildren) {
                notifyDescendants(
                  grandchildren,
                  isAPrimitive ? b : a,
                  isAPrimitive,
                  lane
                );
              }

              if (isListened) {
                notify(listeners, dependents, lane, b, a);
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

    let sharedKeys = 0;

    for (let i = 0; i < aL; i++) {
      const key = aKeys[i];

      const child = children && children.get(key);

      const listeners = child && child._listeners;

      const dependents = child && child._dependents;

      const isListened =
        !!(listeners && listeners.length) ||
        !!(dependents && dependents.length);

      const grandchildren = child && child._children;

      if (key in nextValue) {
        sharedKeys++;
      }

      if (scanUntilMismatch || isListened || grandchildren) {
        const a = prevValue[key];

        const b = nextValue[key];

        if (a !== b) {
          const isAPrimitive = a == null || typeof a != 'object';

          const isBPrimitive = b == null || typeof b != 'object';

          if (
            isAPrimitive ||
            isBPrimitive ||
            compareAndNotify(
              a,
              b,
              grandchildren,
              scanUntilMismatch || isListened,
              lane
            )
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
                isAPrimitive,
                lane
              );
            }

            if (isListened) {
              notify(listeners!, dependents!, lane, b, a);
            }

            result = true;
          }
        }
      }
    }

    const bKeys = Object.keys(nextValue);

    const bL = bKeys.length;

    if (bL !== sharedKeys) {
      for (let i = 0; i < bL; i++) {
        const key = bKeys[i];

        if (!(key in prevValue)) {
          const child = children && children.get(key);

          const listeners = child && child._listeners;

          const dependents = child && child._dependents;

          const isListened =
            !!(listeners && listeners.length) ||
            !!(dependents && dependents.length);

          const grandchildren = child && child._children;

          if (scanUntilMismatch || isListened || grandchildren) {
            const b = nextValue[key];

            if (b !== undefined) {
              if (scanUntilMismatch) {
                if (!children) {
                  return true;
                }

                scanUntilMismatch = false;
              }

              if (grandchildren && b && typeof b == 'object') {
                notifyDescendants(grandchildren, b, true, lane);
              }

              if (isListened) {
                notify(listeners!, dependents!, lane, b, undefined);
              }

              result = true;
            }
          }
        }
      }
    }

    return result;
  }

  if (aPrototype == arrayPrototype) {
    const lPrev = prevValue.length;

    const lNext = nextValue.length;

    result = lPrev != lNext;

    if (scanUntilMismatch && result) {
      if (!children) {
        return true;
      }

      scanUntilMismatch = false;
    }

    for (let i = 0; i < lNext; i++) {
      const key = '' + i;

      const child = children && children.get(key);

      const listeners = child && child._listeners;

      const dependents = child && child._dependents;

      const isListened =
        !!(listeners && listeners.length) ||
        !!(dependents && dependents.length);

      const grandchildren = child && child._children;

      if (scanUntilMismatch || isListened || grandchildren) {
        const a = prevValue[i];

        const b = nextValue[i];

        if (a !== b) {
          const isAPrimitive = a == null || typeof a != 'object';

          const isBPrimitive = b == null || typeof b != 'object';

          if (
            isAPrimitive ||
            isBPrimitive ||
            compareAndNotify(
              a,
              b,
              grandchildren,
              scanUntilMismatch || isListened,
              lane
            )
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
                isAPrimitive,
                lane
              );
            }

            if (isListened) {
              notify(listeners!, dependents!, lane, b, a);
            }

            result = true;
          }
        }
      }
    }

    for (let i = lNext; i < lPrev; i++) {
      const a = prevValue[i];

      const child = children!.get('' + i);

      if (child && a !== undefined) {
        if (child._children && a && typeof a == 'object') {
          notifyDescendants(child._children, a, false, lane);
        }

        notify(child._listeners, child._dependents, lane, undefined, a);
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

  const keysCount = keys.length;

  if (keysCount) {
    const children = patchNode._children;

    const value = patchNode._value;

    const copy = isArray(value) ? value.slice() : { ...value };

    for (let i = 0; i < keysCount; i++) {
      const key = keys[i];

      copy[key] = buildPatchedValue(children.get(key)!);
    }

    return copy;
  }

  return patchNode._value;
};

export const commitNextValue = (
  nextValue: any,
  prevValue: any,
  internals: ControlInternalsChild | undefined,
  lane: Lane
) => {
  if (prevValue !== nextValue) {
    const isAPrimitive = prevValue == null || typeof prevValue != 'object';

    const isBPrimitive = nextValue == null || typeof nextValue != 'object';

    const children = internals && internals._children;

    if (
      isAPrimitive ||
      isBPrimitive ||
      compareAndNotify(prevValue, nextValue, children, true, lane)
    ) {
      if (isAPrimitive != isBPrimitive && children) {
        notifyDescendants(
          children,
          isAPrimitive ? nextValue : prevValue,
          isAPrimitive,
          lane
        );
      }

      return nextValue;
    }
  }

  return UNCHANGED;
};

export const commitPatchNode = (
  patchNode: PatchTreeNode,
  prevValue: any,
  internals: ControlInternalsChild | undefined,
  lane: Lane
): any => {
  if (patchNode._hasValuePatch) {
    return commitNextValue(
      buildPatchedValue(patchNode),
      prevValue,
      internals,
      lane
    );
  }

  if (prevValue == null || typeof prevValue != 'object') {
    throw new Error(
      `Cannot set properties of ${prevValue !== null ? typeof prevValue : 'null'}`
    );
  }

  const keys = patchNode._patchedKeys;

  const keysCount = keys.length;

  const children = patchNode._children;

  const controlChildren = internals && internals._children;

  for (let i = 0; i < keysCount; i++) {
    const key = keys[i];

    const nextValue = commitPatchNode(
      children.get(key)!,
      prevValue[key],
      controlChildren && controlChildren.get(key),
      lane
    );

    if (nextValue !== UNCHANGED) {
      let value;

      if (isArray(prevValue)) {
        value = prevValue.slice();

        value[key as `${number}`] = nextValue;
      } else {
        value = { ...prevValue, [key]: nextValue };
      }

      while (++i < keysCount) {
        const key = keys[i];

        const nextValue = commitPatchNode(
          children.get(key)!,
          prevValue[key],
          controlChildren && controlChildren.get(key),
          lane
        );

        if (nextValue !== UNCHANGED) {
          value[key] = nextValue;
        }
      }

      if (internals) {
        notify(
          internals._listeners,
          internals._dependents,
          lane,
          value,
          prevValue
        );
      }

      return value;
    }
  }

  return UNCHANGED;
};
