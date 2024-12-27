import type { LoadableState } from '../types';
import { get, set, _onValueChange } from '../utils/state/wrapped';

/**
 * A utility function to prevent hooks from triggering the loading behavior of a {@link state}.
 * Wrapping a {@link state} with this function ensures that hooks like `useValue` or `use`
 * will not initiate the loading, allowing you to access the current value without triggering a load.
 */
const withoutLoading = <S extends LoadableState>(state: S): Omit<S, 'load'> =>
  ('_path' in state
    ? {
        _root: state._root,
        get: state.get,
        set: state.set,
        _onValueChange: state._onValueChange,
        error: state.error,
        isLoaded: state.isLoaded,
        control: (state as any as LoadableState<any, any, any>).control,
      }
    : {
        _root: state as any,
        get,
        set,
        _onValueChange,
        error: state.error,
        isLoaded: state.isLoaded,
        control: (state as any as LoadableState<any, any, any>).control,
        _awaitOnly: true,
      }) as LoadableState<any, any, any> as any;

export default withoutLoading;
