import useConst from 'react-helpful-utils/useConst';
import createControl from '#@/createControl';

const useControl = ((defaultValue: any, syncExternalStorage: any) =>
  useConst(() =>
    createControl(defaultValue, syncExternalStorage)
  )) as typeof createControl;

export default useControl;
