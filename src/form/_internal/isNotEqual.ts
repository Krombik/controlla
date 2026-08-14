const getPrototypeOf = Object.getPrototypeOf;

const getKeys = Object.keys;

const objectPrototype = Object.prototype;

const arrayPrototype = Array.prototype;

const datePrototype = Date.prototype;

/**
 * Whether a pair of members differs. Equal ones and the ones worth descending
 * into cost nothing here - only a pair of objects reaches the stack, so a
 * value made of primitives never grows it.
 */
const diffMember = (stack: any[], a: any, b: any) => {
  if (a !== b) {
    if (
      a === null ||
      b === null ||
      typeof a != 'object' ||
      typeof b != 'object'
    ) {
      // NaN is the only value that isn't itself, so two of them are one input
      return a === a || b === b;
    }

    stack.push(a, b);
  }

  return false;
};

/**
 * Structural comparison against a baseline: a commit that rebuilds a node
 * hands out a fresh object even when nothing under it ends up different, so
 * a dirty check by reference would never clear.
 *
 * A key holding `undefined` counts as absent, matching how a value with the
 * key left out is written back.
 */
const isNotEqual = (a: any, b: any): boolean => {
  if (a === b) {
    return false;
  }

  if (
    a === null ||
    b === null ||
    typeof a != 'object' ||
    typeof b != 'object'
  ) {
    return a === a || b === b;
  }

  // past this point every pair reaching the loop is a pair of objects
  const stack: any[] = [];

  for (;;) {
    const prototype = getPrototypeOf(a);

    if (prototype !== getPrototypeOf(b)) {
      return true;
    }

    if (prototype == arrayPrototype) {
      const length = a.length;

      if (length != b.length) {
        return true;
      }

      for (let i = 0; i < length; i++) {
        if (diffMember(stack, a[i], b[i])) {
          return true;
        }
      }
    } else if (prototype == objectPrototype) {
      const keys = getKeys(a);

      const keysCount = keys.length;

      let count = 0;

      for (let i = 0; i < keysCount; i++) {
        const key = keys[i];

        const value = a[key];

        if (value !== undefined) {
          count++;

          const other = b[key];

          if (other === undefined || diffMember(stack, value, other)) {
            return true;
          }
        }
      }

      // every counted key was found in `b`, so only an extra one there can
      // still differ - and it can't when the counts already line up
      const otherKeys = getKeys(b);

      const otherKeysCount = otherKeys.length;

      if (otherKeysCount != count) {
        let otherCount = 0;

        for (let i = 0; i < otherKeysCount; i++) {
          if (b[otherKeys[i]] !== undefined && ++otherCount > count) {
            return true;
          }
        }
      }
    } else if (prototype != datePrototype || a.getTime() != b.getTime()) {
      return true;
    }

    if (!stack.length) {
      return false;
    }

    b = stack.pop();

    a = stack.pop();
  }
};

export default isNotEqual;
