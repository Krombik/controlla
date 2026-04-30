import useConst from 'react-helpful-utils/useConst';
import createControl from '#@/createControl';
import { INTERNALS } from '#shared-internal/constants';
import { RootControlNode } from '#internal/types';
import { useEffect } from 'react';

const useControl = ((defaultValue: any, syncExternalStorage: any) => {
  const control = useConst(() =>
    createControl(defaultValue, syncExternalStorage)
  );

  (control[INTERNALS] as RootControlNode)._useCleanup(useEffect);

  return control;
}) as typeof createControl;

export default useControl;
