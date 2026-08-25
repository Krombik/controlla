import { useRef } from 'react';
import type { Control } from '#types';
import append from '#internal/append';
import type { Subscription } from '#internal/types';
import { cleanupScope } from '#internal/cleanup';
import noop from '#internal/noop';
import useSubscription from '#internal/useSubscription';

/**
 * What a creation that registered nothing is mounted through - a `once` control
 * over sources that were all ready has nothing left to follow. Stands in so the
 * hook below is handed one subscription and one dep either way.
 */
const INERT_SCOPE: Subscription[] = [
  { _subscribe: noop, _cleanup: noop, _resync: noop },
];

/**
 * Rebuilds the control when a {@link controls} entry changes identity.
 * {@link combiner} is left out of that check and captured on build — a rebuild
 * per fresh closure would defeat reusing the control.
 */
const useDerived = (
  make: (params: any[], once: boolean) => any,
  controls: any[],
  once: boolean,
  combiner?: (...values: any[]) => any
) => {
  const ref = useRef<[Subscription[], Control[], Control] | null>(null);

  let item = ref.current;

  if (item) {
    const prevControls = item[1];

    const withoutCombiner = combiner === undefined;

    let controlsCount = prevControls.length;

    if (withoutCombiner && controlsCount > 1) {
      controlsCount--;
    }

    for (let i = 0; i < controlsCount; i++) {
      if (prevControls[i] != controls[i]) {
        item[0] = cleanupScope._value = [];

        item[1] = controls;

        try {
          item[2] = make(
            withoutCombiner ? controls : append(controls, combiner),
            once
          );
        } finally {
          cleanupScope._value = null;
        }

        break;
      }
    }
  } else {
    try {
      ref.current = item = [
        (cleanupScope._value = []),
        controls,
        make(
          combiner === undefined ? controls : append(controls, combiner),
          once
        ),
      ];
    } finally {
      cleanupScope._value = null;
    }
  }

  const scope = item[0].length ? item[0] : INERT_SCOPE;

  useSubscription(scope[0], scope);

  return item[2];
};

export default useDerived;
