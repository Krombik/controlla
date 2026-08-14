import type {
  PatchTreeNode,
  Lane,
  ControlInternalsChild,
  RootBase,
} from '#internal/types';
import { flushNotifications, notify, queueNotify } from '#internal/flushQueue';
import reportError from '#internal/reportError';

export const UNCHANGED = Symbol();

const objectPrototype = Object.prototype;

const arrayPrototype = Array.prototype;

const datePrototype = Date.prototype;

const getPrototypeOf = Object.getPrototypeOf;

const isArray = Array.isArray;

/** Whether anything would be reached by notifying it. */
const isListened = (internals: ControlInternalsChild) =>
  !!internals._listeners.length || !!internals._dependents.length;

/**
 * How the walk reports a changed node: {@link notify} straight through while the
 * root value it belongs to is already in place, {@link queueNotify} while the
 * walk is still assembling it.
 */
type Emit = typeof notify;

/**
 * A subtree appeared or vanished: children get `(value, undefined)` when
 * `emitSourceValues`, `(undefined, value)` otherwise.
 */
const notifyDescendants = (
  children: Map<string, ControlInternalsChild>,
  source: any,
  emitSourceValues: boolean,
  lane: Lane,
  emit: Emit
) => {
  const queue = [children, source];

  do {
    const value = queue.pop();

    const children: Map<string, ControlInternalsChild> = queue.pop();

    const it = children.keys();

    for (let i = children.size; i--;) {
      const key = it.next().value!;

      const childValue = value[key];

      if (childValue !== undefined) {
        const child = children.get(key)!;

        if (isListened(child)) {
          emit(
            child,
            lane,
            emitSourceValues ? childValue : undefined,
            emitSourceValues ? undefined : childValue
          );
        }

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
  lane: Lane,
  emit: Emit
): boolean => {
  // NaN is the only value that isn't itself, so two of them are one input
  if (a === b || (a !== a && b !== b)) {
    return false;
  }

  const listened = !!child && isListened(child);

  const grandchildren = child && child._children;

  if (!scan && !listened && !grandchildren) {
    return false;
  }

  const isAPrimitive = a == null || typeof a != 'object';

  const isBPrimitive = b == null || typeof b != 'object';

  if (
    isAPrimitive ||
    isBPrimitive ||
    compareAndNotify(a, b, grandchildren, scan || listened, lane, emit)
  ) {
    if (isAPrimitive != isBPrimitive && grandchildren) {
      notifyDescendants(
        grandchildren,
        isAPrimitive ? b : a,
        isAPrimitive,
        lane,
        emit
      );
    }

    if (listened) {
      emit(child!, lane, b, a);
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
  lane: Lane,
  emit: Emit
) => {
  const aPrototype = getPrototypeOf(prevValue);

  if (aPrototype != getPrototypeOf(nextValue)) {
    if (children) {
      const it = children.keys();

      for (let i = children.size; i--;) {
        const key = it.next().value!;

        diffPair(
          prevValue[key],
          nextValue[key],
          children.get(key)!,
          false,
          lane,
          emit
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
            lane,
            emit
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
                  lane,
                  emit
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

    if (result) {
      // length differs: the diff is proven, so scanning can stop
      if (children) {
        scanUntilMismatch = false;

        // `.length` is a readonly child control that changes only with the count
        const lengthChild = children.get('length');

        if (lengthChild && isListened(lengthChild)) {
          emit(lengthChild, lane, lNext, lPrev);
        }
      } else if (scanUntilMismatch) {
        return true;
      }
    }

    for (let i = 0; i < lNext; i++) {
      const child = children && children.get('' + i);

      if (scanUntilMismatch || child) {
        if (
          diffPair(
            prevValue[i],
            nextValue[i],
            child,
            scanUntilMismatch,
            lane,
            emit
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

    for (let i = lNext; i < lPrev; i++) {
      const a = prevValue[i];

      const child = children!.get('' + i);

      if (child && a !== undefined) {
        if (child._children && a && typeof a == 'object') {
          notifyDescendants(child._children, a, false, lane, emit);
        }

        if (isListened(child)) {
          emit(child, lane, undefined, a);
        }
      }
    }

    return result;
  }

  return (
    aPrototype != datePrototype || prevValue.getTime() != nextValue.getTime()
  );
};

const buildPatchedValue = (patchNode: PatchTreeNode, base: any) => {
  const keys = patchNode._patchedKeys;

  const keysCount = keys.length;

  const value = patchNode._type ? patchNode._value : base;

  if (keysCount) {
    const children = patchNode._children;

    const copy = isArray(value) ? value.slice() : { ...value };

    for (let i = 0; i < keysCount; i++) {
      const key = keys[i];

      copy[key] = buildPatchedValue(children.get(key)!, copy[key]);
    }

    return copy;
  }

  return value;
};

const commitNextValue = (
  nextValue: any,
  prevValue: any,
  internals: ControlInternalsChild | undefined,
  lane: Lane,
  emit: Emit
) => {
  if (
    prevValue !== nextValue &&
    (prevValue === prevValue || nextValue === nextValue)
  ) {
    const isAPrimitive = prevValue == null || typeof prevValue != 'object';

    const isBPrimitive = nextValue == null || typeof nextValue != 'object';

    const children = internals && internals._children;

    if (
      isAPrimitive ||
      isBPrimitive ||
      compareAndNotify(prevValue, nextValue, children, true, lane, emit)
    ) {
      if (isAPrimitive != isBPrimitive && children) {
        notifyDescendants(
          children,
          isAPrimitive ? nextValue : prevValue,
          isAPrimitive,
          lane,
          emit
        );
      }

      return nextValue;
    }
  }

  return UNCHANGED;
};

const commitKeyedPatch = (
  patchNode: PatchTreeNode,
  prevValue: any,
  internals: ControlInternalsChild | undefined,
  lane: Lane,
  emit: Emit
): any => {
  if (prevValue == null || typeof prevValue != 'object') {
    // the patch targets a subtree that is not there - drop it, a sibling key
    // still commits
    reportError(
      new Error(
        `Cannot set properties of ${prevValue !== null ? typeof prevValue : 'null'}`
      )
    );

    return UNCHANGED;
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

    const nextValue = commitPatch(
      children.get(key)!,
      prevChildValue,
      child,
      lane,
      emit
    );

    if (nextValue !== UNCHANGED) {
      // each level notifies its changed children; the root is the commit's job
      if (child && isListened(child)) {
        emit(child, lane, nextValue, prevChildValue);
      }

      if (value === undefined) {
        value = isArray(prevValue) ? prevValue.slice() : { ...prevValue };
      }

      value[key] = nextValue;
    }
  }

  return value !== undefined ? value : UNCHANGED;
};

/** A patch node of either kind - the keys of a keyed one carry either. */
const commitPatch = (
  patchNode: PatchTreeNode,
  prevValue: any,
  internals: ControlInternalsChild | undefined,
  lane: Lane,
  emit: Emit
) =>
  patchNode._type
    ? commitNextValue(
        buildPatchedValue(patchNode, prevValue),
        prevValue,
        internals,
        lane,
        emit
      )
    : commitKeyedPatch(patchNode, prevValue, internals, lane, emit);

/**
 * Commits a {@link nextValue} the caller already holds: it goes into the
 * {@link root} before the diff runs, so every listener the diff reaches reads
 * the value its change is part of, and is rolled back if nothing turned out to
 * differ - nothing was notified, so nobody saw it.
 */
export const commitRootValue = (
  root: ControlInternalsChild & RootBase,
  nextValue: any,
  prevValue: any,
  lane: Lane
) => {
  root._value = nextValue;

  const result = commitNextValue(nextValue, prevValue, root, lane, notify);

  if (result === UNCHANGED) {
    root._value = prevValue;
  }

  return result;
};

/**
 * The same for a patch. One that carries a whole value knows it up front, so it
 * takes the direct route; a keyed one is only assembled by the walk, so its
 * notifications wait for the value that walk returns.
 */
export const commitRootPatch = (
  root: ControlInternalsChild & RootBase,
  patchNode: PatchTreeNode,
  prevValue: any,
  lane: Lane
) => {
  if (patchNode._type) {
    return commitRootValue(
      root,
      buildPatchedValue(patchNode, prevValue),
      prevValue,
      lane
    );
  }

  const nextValue = commitKeyedPatch(
    patchNode,
    prevValue,
    root,
    lane,
    queueNotify
  );

  if (nextValue !== UNCHANGED) {
    root._value = nextValue;

    flushNotifications();
  }

  return nextValue;
};
