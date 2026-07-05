import type createAsyncDerivedControl from '#core/createAsyncDerivedControl';
import makeAsyncDerivedControl from '#internal/makeAsyncDerivedControl';
import makeUseDerivedControl from '#internal/makeUseDerivedControl';

const useAsyncDerivedControl: typeof createAsyncDerivedControl =
  makeUseDerivedControl(makeAsyncDerivedControl);

export default useAsyncDerivedControl;
