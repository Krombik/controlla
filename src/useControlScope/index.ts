import { useConst } from 'react-helpful-utils';
import createControlScope from '../createControlScope';

const useControl = ((defaultValue: any, controlInitializer: any) =>
  useConst(() =>
    createControlScope(defaultValue, controlInitializer)
  )) as typeof createControlScope;

export default useControl;
