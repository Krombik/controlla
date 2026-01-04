import useConst from 'react-helpful-utils/useConst';
import createControlScope from '#@/createControlScope';

const useControl = ((defaultValue: any, syncExternalStorage: any) =>
  useConst(() =>
    createControlScope(defaultValue, syncExternalStorage)
  )) as typeof createControlScope;

export default useControl;
