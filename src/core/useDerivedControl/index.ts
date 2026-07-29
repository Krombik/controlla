import type createDerivedControl from '#core/createDerivedControl';
import makeDerivedControl from '#internal/makeDerivedControl';
import useDerived from '#internal/useDerived';

const useDerivedControl: typeof createDerivedControl = (
  ...params: any[]
): any => useDerived(makeDerivedControl, params);

export default useDerivedControl;
