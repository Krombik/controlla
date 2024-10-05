import { AsyncState, ControllableLoadableState, LoadableState } from '../types';

const awaitOnly = <S extends AsyncState<any>>(
  state: S
): S extends ControllableLoadableState<any>
  ? ControllableLoadableState<void>
  : S extends LoadableState<any>
    ? LoadableState<void>
    : AsyncState<void> => ({
  ...(state as any),
  _awaitOnly: true,
});

export default awaitOnly;
