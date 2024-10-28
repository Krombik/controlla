import type { LoadableState } from '../types';

/**
 * A utility function to prevent hooks from triggering the loading behavior of a {@link state}.
 * Wrapping a {@link state} with this function ensures that hooks like `useValue` or `use`
 * will not initiate the loading, allowing you to access the current value without triggering a load.
 */
const withoutLoading = <S extends LoadableState>(state: S): S => ({
  ...state,
  _withoutLoading: true,
});

export default withoutLoading;
