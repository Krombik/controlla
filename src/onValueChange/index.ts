import type { State, HandlePending } from '../types';

const onValueChange = <T>(
  state: State<T>,
  cb: (value: HandlePending<T>) => void
): (() => void) => state._internal._onValueChange(cb, state._path!);

export default onValueChange;
