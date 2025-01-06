import { ValueChangeCallbacks } from '../types';

const createSubscribe =
  (set: ValueChangeCallbacks) => (cb: (value: any) => void) => {
    set.add(cb);

    return () => {
      set.delete(cb);
    };
  };

export default createSubscribe;
