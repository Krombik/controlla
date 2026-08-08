import type { Control, SyncExternalStorage } from '#types';
import { useContext, useRef } from 'react';
import DisposeContext from '#internal/DisposeContext';
import { cleanupScope } from '#internal/cleanup';

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
      cleanupScope._value = scope;

      try {
        controlRef.current = control = createControl(
          withoutLazyArg || typeof arg1 != 'function' ? arg1 : arg1(),
          externalStorage
        );
      } finally {
        cleanupScope._value = null;
      }
    }

    return control;
  };

export default makeUseControl;
