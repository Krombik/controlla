import forceRerenderReducer from '#internal/forceRerenderReducer';
import type { ControlInternalsChild } from '#internal/types';
import { INTERNALS } from '#shared-internal/constants';
import type { ReadonlyAsyncControl, ReadonlyControl } from '#types';
import noop from 'lodash.noop';
import { useLayoutEffect, useReducer, useRef } from 'react';

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

  const forceRerender = useReducer(forceRerenderReducer, 0)[1];

  const handleSubscriptionsRef =
    useRef<(internals: ControlInternalsChild[]) => void>(noop);

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

      item[INTERNALS]._attach(item, forceRerender, true);
    }

    handleSubscriptionsRef.current = (internals) => {
      const prevL = prevInternals.length;

      const currL = internals.length;

      const minL = prevL > currL ? currL : prevL;

      for (let i = 0; i < minL; i++) {
        const curr = internals[i];

        const prev = prevInternals[i];

        if (prev != curr) {
          curr[INTERNALS]._attach(curr, forceRerender, true);

          prev[INTERNALS]._detach(prev, forceRerender, true);
        }
      }

      if (prevL != currL) {
        if (currL > prevL) {
          for (let i = minL; i < currL; i++) {
            const curr = internals[i];

            curr[INTERNALS]._attach(curr, forceRerender, true);
          }
        } else {
          for (let i = minL; i < prevL; i++) {
            const prev = prevInternals[i];

            prev[INTERNALS]._detach(prev, forceRerender, true);
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

        item[INTERNALS]._detach(item, forceRerender, true);
      }
    };
  }, []);

  for (let i = 0; i < controlsCount; i++) {
    const item = controls[i][INTERNALS];

    internals[i] = item;

    values[i] = item._get();
  }

  return values;
};

export default useInfiniteValues;
