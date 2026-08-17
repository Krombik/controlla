import type createSnapshotControl from '#core/createSnapshotControl';
import makeAsyncDerivedControl from '#internal/makeAsyncDerivedControl';
import useDerived from '#internal/useDerived';

const useSnapshotControl: typeof createSnapshotControl = (
  ...params: any[]
): any => useDerived(makeAsyncDerivedControl, params, true);

export default useSnapshotControl;
