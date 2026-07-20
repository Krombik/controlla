import { EMPTY_ARR, INTERNALS } from '#internal/constants';
import type { SyncExternalStorage } from '#types';
import { useEffect, useRef } from 'react';
import type { ControlInternals } from '#internal/types';

const makeUseControl =
  (
    createControl: (arg1?: any, externalStorage?: SyncExternalStorage) => any,
    hasLazyArg?: boolean
  ) =>
  (arg1?: any, externalStorage?: SyncExternalStorage): any => {
    const controlRef = useRef<{ [INTERNALS]: ControlInternals } | null>(null);

    if (controlRef.current == null) {
      controlRef.current = createControl(
        hasLazyArg && typeof arg1 == 'function' ? arg1() : arg1,
        externalStorage
      );
    }

    useEffect(
      () => () => {
        const internals: ControlInternals = controlRef.current![INTERNALS];

        if (internals._unobserve) {
          internals._unobserve();
        }
      },
      EMPTY_ARR
    );

    return controlRef.current;
  };

export default makeUseControl;
