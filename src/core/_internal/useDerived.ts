import type { DerivedControlInternals } from '#internal/derivedControlUtils';
import { INTERNALS } from '#internal/constants';
import DisposeContext from '#internal/DisposeContext';
import { useContext, useRef } from 'react';
import type { Control } from '#types';
import append from '#internal/append';
import removeFromArray from '#internal/removeFromArray';
import { cleanupScope } from '#internal/cleanup';

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

        if (scope) {
          removeFromArray(scope, cleanup);

          cleanupScope._value = scope;
        }

        try {
          item._controls = controls;

          item._item = make(
            combiner === undefined ? controls : append(controls, combiner),
            once
          );
        } finally {
          cleanupScope._value = null;
        }

        break;
      }
    }
  } else {
    cleanupScope._value = scope;

    try {
      ref.current = item = {
        _controls: controls,
        _item: make(
          combiner === undefined ? controls : append(controls, combiner),
          once
        ),
      };
    } finally {
      cleanupScope._value = null;
    }
  }

  return item._item;
};

export default useDerived;
