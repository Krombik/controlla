import { AsyncState, ControllableLoadableState, LoadableState } from '../types';

const awaitOnly = <S extends AsyncState>(
  state: S
): S extends ControllableLoadableState
  ? ControllableLoadableState<void>
  : S extends LoadableState
    ? LoadableState<void>
    : AsyncState<void> => ({
  ...(state as any),
  _awaitOnly: true,
});

export default awaitOnly;
