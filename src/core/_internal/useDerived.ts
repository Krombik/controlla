import type { DerivedControlInternals } from '#internal/derivedControlUtils';
import { INTERNALS } from '#internal/constants';
import DisposeContext from '#internal/DisposeContext';
import { useContext, useRef } from 'react';
import type { Control } from '#types';
import append from '#internal/append';
import removeFromArray from '#internal/removeFromArray';

/**
 * Rebuilds the control when a {@link controls} entry changes identity.
 * {@link combiner} is left out of that check and captured on build — a rebuild
 * per fresh closure would defeat reusing the control.
 */
const useDerived = (
  make: (params: any[]) => any,
  controls: any[],
  combiner?: (...values: any[]) => any
) => {
  const ref = useRef<null | { _controls: Control[]; _item: Control }>(null);

  const scope = useContext(DisposeContext);

  let item = ref.current;

  if (item) {
    const prevControls = item._controls;

    const withoutCombiner = combiner === undefined;

    let controlsCount = prevControls.length;

    if (withoutCombiner && controlsCount > 1) {
      controlsCount--;
    }

    for (let i = 0; i < controlsCount; i++) {
      if (prevControls[i] != controls[i]) {
        const cleanup = (item._item[INTERNALS] as DerivedControlInternals)
          ._cleanup;

        cleanup();

        const control = make(
          combiner === undefined ? controls : append(controls, combiner)
        );

        if (scope) {
          removeFromArray(scope, cleanup);

          scope.push((control[INTERNALS] as DerivedControlInternals)._cleanup);
        }

        item._controls = controls;

        item._item = control;

        break;
      }
    }
  } else {
    const control = make(
      combiner === undefined ? controls : append(controls, combiner)
    );

    ref.current = item = {
      _controls: controls,
      _item: control,
    };

    if (scope) {
      scope.push((control[INTERNALS] as DerivedControlInternals)._cleanup);
    }
  }

  return item._item;
};

export default useDerived;
