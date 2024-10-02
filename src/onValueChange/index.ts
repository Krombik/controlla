import type { State, ResolvedValue } from '../types';

const onValueChange = <T>(
  state: State<T>,
  cb: (value: ResolvedValue<T>) => void
): (() => void) => state._internal._onValueChange(cb, state._path!);

export default onValueChange;
