import useForceRerender from '#internal/useForceRerender';
import type { ControlInternalsChild } from '#internal/types';
import { EMPTY_ARR, INTERNALS } from '#internal/constants';
import type { ReadonlyAsyncControl, ReadonlyControl } from '#types';
import noop from '#internal/noop';
import { useLayoutEffect, useRef } from 'react';

/**
 * Returns the current values of a dynamic list of same-typed
 * {@link controls}, subscribing to each — unlike per-control hooks, the array
 * may grow or shrink between renders, which makes it suited for
 * paginated/infinite data (e.g. page controls taken from a registry).
 *
 * Values are positional; async controls provide `value | undefined` and start
 * loading when consumed.
 *
 * @example
 * ```ts
 * const pages = useInfiniteValues(
 *   pageNumbers.map((page) => productsRegistry.get(page))
 * );
 * ```
 */
const useInfiniteValues = <C extends ReadonlyControl>(
  controls: C[]
): Array<
  C extends ReadonlyAsyncControl<infer K>
    ? K | undefined
    : C extends ReadonlyControl<infer K>
      ? K
      : never
> => {
  const controlsCount = controls.length;

  const values = Array(controlsCount);

  const internals = Array<ControlInternalsChild>(controlsCount);

  const forceRerender = useForceRerender();

  const handleSubscriptionsRef =
    useRef<(internals: ControlInternalsChild[]) => void>(noop);

  // every render: diff subscriptions against the previous controls list
  useLayoutEffect(() => {
    handleSubscriptionsRef.current(internals);
  });

  useLayoutEffect(() => {
    let prevInternals = internals;

    let isActual = true;

    for (let i = 0; i < controlsCount; i++) {
      const item = prevInternals[i];

      if (isActual && values[i] !== item._get()) {
        isActual = false;
      }

      item._root._attach(item, forceRerender, true);
    }

    handleSubscriptionsRef.current = (internals) => {
      const prevL = prevInternals.length;

      const currL = internals.length;

      const minL = prevL > currL ? currL : prevL;

      for (let i = 0; i < minL; i++) {
        const curr = internals[i];

        const prev = prevInternals[i];

        if (prev != curr) {
          curr._root._attach(curr, forceRerender, true);

          prev._root._detach(prev, forceRerender, true);
        }
      }

      if (prevL != currL) {
        if (currL > prevL) {
          for (let i = minL; i < currL; i++) {
            const curr = internals[i];

            curr._root._attach(curr, forceRerender, true);
          }
        } else {
          for (let i = minL; i < prevL; i++) {
            const prev = prevInternals[i];

            prev._root._detach(prev, forceRerender, true);
          }
        }
      }

      prevInternals = internals;
    };

    if (!isActual) {
      forceRerender();
    }

    return () => {
      for (let i = 0; i < prevInternals.length; i++) {
        const item = prevInternals[i];

        item._root._detach(item, forceRerender, true);
      }
    };
  }, EMPTY_ARR);

  for (let i = 0; i < controlsCount; i++) {
    const item = controls[i][INTERNALS];

    internals[i] = item;

    values[i] = item._get();
  }

  return values;
};

export default useInfiniteValues;
