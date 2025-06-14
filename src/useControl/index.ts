import { useConst } from 'react-helpful-utils';
import createControl from '../createControl';

const useControl = ((defaultValue: any, controlInitializer: any) =>
  useConst(() =>
    createControl(defaultValue, controlInitializer)
  )) as typeof createControl;

export default useControl;
