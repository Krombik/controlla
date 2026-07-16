import type {
  PatchTreeNode,
  Lane,
  ControlInternalsChild,
} from '#internal/types';
import { notify } from '#internal/flushQueue';

export const UNCHANGED = Symbol();

const objectPrototype = Object.prototype;

const arrayPrototype = Array.prototype;

const datePrototype = Date.prototype;

const getPrototypeOf = Object.getPrototypeOf;

const isArray = Array.isArray;

/**
 * A subtree appeared or vanished: children get `(value, undefined)` when
 * `emitSourceValues`, `(undefined, value)` otherwise.
 */
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

/**
 * Diffs one key pair, notifying the child subtree on change. Returns whether
 * the values differ; without `scan` an unobserved pair reports `false`.
 */
const diffPair = (
  a: any,
  b: any,
  child: ControlInternalsChild | undefined,
  scan: boolean,
  lane: Lane
): boolean => {
  if (a === b) {
    return false;
  }

  const listeners = child && child._listeners;

  const dependents = child && child._dependents;

  const isListened =
    !!(listeners && listeners.length) || !!(dependents && dependents.length);

  const grandchildren = child && child._children;

  if (!scan && !isListened && !grandchildren) {
    return false;
  }

  const isAPrimitive = a == null || typeof a != 'object';

  const isBPrimitive = b == null || typeof b != 'object';

  if (
    isAPrimitive ||
    isBPrimitive ||
    compareAndNotify(a, b, grandchildren, scan || isListened, lane)
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
      notify(listeners!, dependents!, lane, b, a);
    }

    return true;
  }

  return false;
};

/**
 * Returns whether the values differ; `scanUntilMismatch` keeps scanning
 * unlistened keys only until the first proven difference.
 */
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

        diffPair(
          prevValue[key],
          nextValue[key],
          children.get(key)!,
          false,
          lane
        );
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

      if (key in nextValue) {
        sharedKeys++;
      }

      const child = children && children.get(key);

      if (scanUntilMismatch || child) {
        if (
          diffPair(
            prevValue[key],
            nextValue[key],
            child,
            scanUntilMismatch,
            lane
          )
        ) {
          if (scanUntilMismatch) {
            if (!children) {
              return true;
            }

            scanUntilMismatch = false;
          }

          result = true;
        }
      }
    }

    // added keys can't matter once a difference is proven and nothing listens
    if (children || scanUntilMismatch || !result) {
      const bKeys = Object.keys(nextValue);

      const bL = bKeys.length;

      if (bL !== sharedKeys) {
        for (let i = 0; i < bL; i++) {
          const key = bKeys[i];

          if (!(key in prevValue)) {
            const child = children && children.get(key);

            if (scanUntilMismatch || child) {
              if (
                diffPair(
                  undefined,
                  nextValue[key],
                  child,
                  scanUntilMismatch,
                  lane
                )
              ) {
                if (scanUntilMismatch) {
                  if (!children) {
                    return true;
                  }

                  scanUntilMismatch = false;
                }

                result = true;
              }
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
      const child = children && children.get('' + i);

      if (scanUntilMismatch || child) {
        if (
          diffPair(prevValue[i], nextValue[i], child, scanUntilMismatch, lane)
        ) {
          if (scanUntilMismatch) {
            if (!children) {
              return true;
            }

            scanUntilMismatch = false;
          }

          result = true;
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
  if (patchNode._type) {
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

  let value: any;

  for (let i = 0; i < keysCount; i++) {
    const key = keys[i];

    const prevChildValue = prevValue[key];

    const child = controlChildren && controlChildren.get(key);

    const nextValue = commitPatchNode(
      children.get(key)!,
      prevChildValue,
      child,
      lane
    );

    if (nextValue !== UNCHANGED) {
      // each level notifies its changed children; the root is the commit's job
      if (child) {
        notify(
          child._listeners,
          child._dependents,
          lane,
          nextValue,
          prevChildValue
        );
      }

      if (value === undefined) {
        value = isArray(prevValue) ? prevValue.slice() : { ...prevValue };
      }

      value[key] = nextValue;
    }
  }

  return value !== undefined ? value : UNCHANGED;
};
