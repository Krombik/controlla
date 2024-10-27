import { LoadableState } from '../types';

const withoutLoading = <S extends LoadableState>(state: S): S => ({
  ...state,
  _withoutLoading: true,
});

export default withoutLoading;
