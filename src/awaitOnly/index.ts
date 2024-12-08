import type { AsyncState, LoadableState } from '../types';

/** Makes the given {@link state} to be awaited only, without triggering re-renders on state changes. */
const awaitOnly = <S extends AsyncState>(
  state: S
): S extends LoadableState<any, infer E, infer C>
  ? LoadableState<void, E, C>
  : S extends AsyncState<any, infer E>
    ? AsyncState<void, E>
    : never => ({
  ...(state as any),
  _awaitOnly: true,
});

export default awaitOnly;
