import type createAsyncDerivedControl from '#core/createAsyncDerivedControl';
import makeAsyncDerivedControl from '#internal/makeAsyncDerivedControl';
import useDerived from '#internal/useDerived';

const useAsyncDerivedControl: typeof createAsyncDerivedControl = (
  ...params: any[]
): any => useDerived(makeAsyncDerivedControl, params, false);

export default useAsyncDerivedControl;
