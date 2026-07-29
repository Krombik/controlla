import type { DerivedControlInternals } from '#internal/derivedControlUtils';
import { EMPTY_ARR, INTERNALS } from '#internal/constants';
import { useEffect, useRef } from 'react';
import removeFromArray from '#internal/removeFromArray';
import type { Control } from '#types';
import append from '#internal/append';

const detach = (item: Control) => {
  const notifiers = (item[INTERNALS] as DerivedControlInternals)._notifiers;

  if (Array.isArray(notifiers)) {
    for (let i = 0, l = notifiers.length; i < l; i++) {
      removeFromArray(notifiers[i]._attachedTo, notifiers[i]);

      notifiers[i]._source = undefined;
    }
  } else {
    removeFromArray(notifiers._attachedTo, notifiers);

    notifiers._source = undefined;
  }
};

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
        detach(item._item);

        item._controls = controls;

        item._item = make(
          withoutCombiner ? controls : append(controls, combiner)
        );

        break;
      }
    }
  } else {
    ref.current = item = {
      _controls: controls,
      _item: make(
        combiner === undefined ? controls : append(controls, combiner)
      ),
    };
  }

  useEffect(() => () => detach(ref.current!._item), EMPTY_ARR);

  return item._item;
};

export default useDerived;
