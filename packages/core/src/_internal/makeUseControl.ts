import { INTERNALS } from '#shared-internal/constants';
import { SyncExternalStorage } from '#types';
import { useEffect, useRef } from 'react';
import { ControlInternals } from './types';

const makeUseControl =
  (createControl: (arg1?: any, externalStorage?: SyncExternalStorage) => any) =>
  (arg1?: any, externalStorage?: SyncExternalStorage): any => {
    const controlRef = useRef<{ [INTERNALS]: ControlInternals } | null>(null);

    if (controlRef.current == null) {
      controlRef.current = createControl(arg1, externalStorage);
    }

    if (externalStorage) {
      useEffect(
        () => () => {
          const internals: ControlInternals = controlRef.current![INTERNALS];

          if (internals._unobserve) {
            internals._unobserve();
          }
        },
        []
      );
    }

    return controlRef.current;
  };

export default makeUseControl;
