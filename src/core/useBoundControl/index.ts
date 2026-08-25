import type { PrimitiveOrNested } from 'keyweaver';
import type { Bound, Control, MixedKeys, Registry } from '#types';
import { useInsertionEffect, useRef } from 'react';
import makeBoundControl from '#internal/makeBoundControl';
import type { Subscription } from '#internal/types';
import { cleanupScope } from '#internal/cleanup';
import noop from '#internal/noop';
import { EMPTY_ARR, INTERNALS } from '#internal/constants';
import isNotEqual from '#internal/isNotEqual';

/** A control key stands for itself, anything else is compared by value. */
const isDifferentKeys = (prevKeys: any[], keys: any[]) => {
  for (let i = 0, l = prevKeys.length; i < l; i++) {
    const prev = prevKeys[i];

    const next = keys[i];

    if (
      prev !== next &&
      ((prev && prev[INTERNALS]) ||
        (next && next[INTERNALS]) ||
        isNotEqual(prev, next))
    ) {
      return true;
    }
  }

  return false;
};

/**
 * A component's own bound controls: gives back a `bind` that resolves a
 * {@link registry} item by key controls, keeping one control per call
 * position - so a list calls it once per row, and how many rows there are may
 * change between renders. Positions are matched in call order, which is what
 * makes it usable with `useInfiniteValues`.
 *
 * A position rebuilds its control when the keys it is called with change, and
 * a control lasts as long as the component keeps asking for that position - it
 * is let go of on unmount, or as soon as a render stops reaching it.
 *
 * The {@link registry} is the one it was first called with: pass a component
 * another one and every position keeps binding into the first.
 *
 * @example
 * ```tsx
 * const bind = useBoundControl(userRegistry);
 *
 * const users = useInfiniteValues(rows.map((row) => bind(row.$id)));
 * ```
 */
const useBoundControl = <
  T extends Control,
  Keys extends Exclude<PrimitiveOrNested, undefined>[],
>(
  registry: Registry<T, Keys>
): (<const K extends MixedKeys<Keys>>(...keys: K) => Bound<T, K>) => {
  const hookRef = useRef<() => (...keys: any[]) => Control>(noop as any);

  let hook = hookRef.current;

  if (hook == noop) {
    /** A control, and the subscription it is. */
    type Item = Control & { readonly [INTERNALS]: Subscription };

    /** What a rebuild replaced and what took its place, in pairs. */
    const rebuilt: Item[] = [];

    /** Per call position, both of them - a control is its own subscription. */
    const keysStack: any[][] = [];

    const controls: Item[] = [];

    /** Where a creation reports, never read - drained right after it. */
    const registered: Subscription[] = [];

    /** How many positions the effects have mounted. */
    let subscribed = 0;

    /** The position the render is at. */
    let index = 0;

    const bind = (...keys: any[]) => {
      let control = controls[index];

      if (control === undefined || isDifferentKeys(keysStack[index], keys)) {
        // a scope of its own, so the creation subscribes nothing right away
        cleanupScope._value = registered;

        let next;

        try {
          controls[index] = next = makeBoundControl(
            registry as any,
            keys.slice()
          ) as Item;
        } finally {
          cleanupScope._value = null;

          registered.length = 0;
        }

        keysStack[index] = keys;

        // a mounted position swaps, an unmounted one is left to the effect
        if (index < subscribed) {
          rebuilt.push(control!, next);
        }

        control = next;
      }

      index++;

      return control;
    };

    hookRef.current = hook = () => {
      index = 0;

      // every commit: whatever this render rebuilt, grew or dropped
      useInsertionEffect(() => {
        const l = rebuilt.length;

        if (l) {
          for (let i = 0; i < l; i += 2) {
            rebuilt[i][INTERNALS]._cleanup();

            rebuilt[i + 1][INTERNALS]._subscribe();
          }

          rebuilt.length = 0;
        }

        while (subscribed < index) {
          controls[subscribed++][INTERNALS]._subscribe();
        }

        while (subscribed > index) {
          controls[--subscribed][INTERNALS]._cleanup();
        }
      });

      useInsertionEffect(
        () => () => {
          while (subscribed) {
            controls[--subscribed][INTERNALS]._cleanup();
          }
        },
        EMPTY_ARR
      );

      return bind;
    };
  }

  return hook() as any;
};

export default useBoundControl;
