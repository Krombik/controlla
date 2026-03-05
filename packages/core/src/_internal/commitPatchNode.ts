import { PatchTreeNode, ControlNode, RootControlNode } from './types';

export const UNCHANGED = Symbol();

const objectPrototype = Object.prototype;

const arrayPrototype = Array.prototype;

const datePrototype = Date.prototype;

const getPrototypeOf = Object.getPrototypeOf;

const isArray = Array.isArray;

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

          child._version++;

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
                child._version++;

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
              child._version++;

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
              child._version++;

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
              child._version++;

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
            child._version++;

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

    const value = patchNode._value;

    const copy = isArray(value) ? value.slice() : { ...value };

    for (let i = 0; i < l; i++) {
      const key = keys[i];

      copy[key] = buildPatchedValue(children.get(key)!);
    }

    return copy;
  }

  return patchNode._value;
};

export const commitPatchNode = (
  patchNode: PatchTreeNode,
  prevValue: any,
  control: ControlNode | undefined
): any => {
  if (patchNode._hasValuePatch) {
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
    if (prevValue == null || typeof prevValue != 'object') {
      throw new Error(
        `Cannot set properties of ${prevValue !== null ? typeof prevValue : 'null'}`
      );
    }

    const keys = patchNode._patchedKeys;

    const l = keys.length;

    const children = patchNode._children;

    const controlChildren = control && control._children;

    for (let i = 0; i < l; i++) {
      const key = keys[i];

      const nextValue = commitPatchNode(
        children.get(key)!,
        prevValue[key],
        controlChildren && controlChildren.get(key)
      );

      if (nextValue !== UNCHANGED) {
        let value;

        if (isArray(prevValue)) {
          value = prevValue.slice();

          value[key as `${number}`] = nextValue;
        } else {
          value = { ...prevValue, [key]: nextValue };
        }

        while (++i < l) {
          const key = keys[i];

          const nextValue = commitPatchNode(
            children.get(key)!,
            prevValue[key],
            controlChildren && controlChildren.get(key)
          );

          if (nextValue !== UNCHANGED) {
            value[key] = nextValue;
          }
        }

        if (control) {
          const callbacks = control._listeners;

          const l = callbacks.length;

          if (l) {
            control._version++;

            for (let i = 0; i < l; i++) {
              callbacks[i](value, prevValue);
            }
          }
        }

        return value;
      }
    }
  }

  return UNCHANGED;
};

export function commitSet(this: RootControlNode, patchNode: PatchTreeNode) {
  const control = this;

  const prevValue = control._value;

  const nextValue = commitPatchNode(patchNode, prevValue, control);

  if (nextValue !== UNCHANGED) {
    control._value = nextValue;

    const callbacks = control._listeners;

    const l = callbacks.length;

    if (l) {
      control._version++;

      for (let i = 0; i < l; i++) {
        callbacks[i](nextValue, prevValue);
      }
    }
  }
}
