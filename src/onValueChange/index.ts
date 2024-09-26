import type { State, WithoutPending } from '../types';

const onValueChange = <T>(
  state: State<T>,
  cb: (value: WithoutPending<T>) => void
) => state._internal._onValueChange(cb, state._path!);

export default onValueChange;
