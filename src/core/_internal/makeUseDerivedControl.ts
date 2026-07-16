import type { DerivedControlInternals } from '#internal/derivedControlUtils';
import { INTERNALS } from '#internal/constants';
import { useEffect, useRef } from 'react';
import removeFromArray from '#internal/removeFromArray';

const makeUseDerivedControl =
  (makeDerivedControl: (params: any[]) => any) =>
  (...params: any[]): any => {
    const itemRef = useRef<null | {
      [INTERNALS]: DerivedControlInternals;
    }>(null);

    if (itemRef.current == null) {
      itemRef.current = makeDerivedControl(params);
    }

    useEffect(
      () => () => {
        const notifiers = itemRef.current![INTERNALS]._notifiers;

        if (Array.isArray(notifiers)) {
          for (let i = 0, l = notifiers.length; i < l; i++) {
            const notifier = notifiers[i];

            removeFromArray(notifier._attachedTo, notifier);
          }
        } else {
          removeFromArray(notifiers._attachedTo, notifiers);
        }
      },
      []
    );

    return itemRef.current;
  };

export default makeUseDerivedControl;
