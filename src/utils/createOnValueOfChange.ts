import type { SetKey, _SimplifiedState } from '../types';
import { RootKey } from './constants';

const createOnValueOfChange =
  (setKey: Exclude<SetKey, RootKey.VALUE_GET_CALLBACK_SET>) =>
  (state: _SimplifiedState, cb: (value: any) => void) => {
    const set = state.r.get(setKey)!;

    set.add(cb);

    return () => {
      set.delete(cb);
    };
  };

export default createOnValueOfChange;
