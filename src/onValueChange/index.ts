import type { Pending, State } from '../types';

const onValueChange = <T>(
  state: State<T>,
  cb: (value: Exclude<T, Pending>) => void
) => {
  const set = state._internal._getValueChangeCallbackSet(state._path!);

  set.add(cb);

  return () => {
    set.delete(cb);
  };
};

export default onValueChange;
