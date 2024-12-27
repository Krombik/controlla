import type { AsyncState, LoadableState } from '../types';
import { get, load, set, _onValueChange } from '../utils/state/wrapped';

/** Makes the given {@link state} to be awaited only, without triggering re-renders on state changes. */
const awaitOnly = <S extends AsyncState>(
  state: S
): S extends LoadableState<any, infer E, infer C>
  ? LoadableState<void, E, C>
  : S extends AsyncState<any, infer E>
    ? AsyncState<void, E>
    : never =>
  (state._root != state
    ? {
        _root: state._root,
        load: (state as any as LoadableState<any, any, any>).load,
        get: state.get,
        set: state.set,
        _onValueChange: state._onValueChange,
        error: state.error,
        isLoaded: state.isLoaded,
        control: (state as any as LoadableState<any, any, any>).control,
        _path: state._path,
        _awaitOnly: true,
      }
    : {
        _root: state as any,
        load: (state as any as LoadableState).load && load,
        get,
        set,
        _onValueChange,
        error: state.error,
        isLoaded: state.isLoaded,
        control: (state as any as LoadableState<any, any, any>).control,
        _awaitOnly: true,
      }) as LoadableState<any, any, any> as any;

export default awaitOnly;
