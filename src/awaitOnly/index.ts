import { AsyncState, ControllableLoadableState, LoadableState } from '../types';

/** Makes the given {@link state} to be awaited only, without triggering re-renders on state changes. */
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
