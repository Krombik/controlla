import { INTERNALS } from '#internal/constants';
import type { Control, SyncExternalStorage } from '#types';
import { useContext, useRef } from 'react';
import type { PrimitiveControlInternals } from '#internal/types';
import DisposeContext from '#internal/DisposeContext';

const makeUseControl =
  (
    createControl: (
      arg1?: any,
      externalStorage?: SyncExternalStorage
    ) => Control,
    withoutLazyArg: boolean
  ) =>
  (arg1?: any, externalStorage?: SyncExternalStorage): any => {
    const controlRef = useRef<Control | null>(null);

    const scope = useContext(DisposeContext);

    let control = controlRef.current;

    if (control === null) {
      controlRef.current = control = createControl(
        withoutLazyArg || typeof arg1 != 'function' ? arg1 : arg1(),
        externalStorage
      );

      if (scope) {
        const cleanup = (control[INTERNALS] as PrimitiveControlInternals)
          ._cleanup;

        if (cleanup) {
          scope.push(cleanup);
        }
      }
    }

    return control;
  };

export default makeUseControl;
