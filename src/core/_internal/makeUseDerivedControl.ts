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
    }
  } else {
    removeFromArray(notifiers._attachedTo, notifiers);
  }
};

/**
 * Deps-aware derived control for hooks and `CombinedControlsConsumer`:
 * rebuilds the control when the {@link controls} set changes (compared by
 * identity), otherwise keeps it and just points it at the latest
 * {@link combiner} — so the combiner needn't be memoized. Takes controls and
 * combiner apart to avoid allocating a combined array on every render (only on
 * a rebuild).
 */
export const useDerived = (
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

  const $control = item._item;

  useEffect(() => () => detach($control), EMPTY_ARR);

  return $control;
};

const makeUseDerivedControl =
  (make: (params: any[]) => any) =>
  (...params: any[]): any =>
    useDerived(make, params);

export default makeUseDerivedControl;
