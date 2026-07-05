import type createDerivedControl from '#core/createDerivedControl';
import makeDerivedControl from '#internal/makeDerivedControl';
import makeUseDerivedControl from '#internal/makeUseDerivedControl';

const useDerivedControl: typeof createDerivedControl =
  makeUseDerivedControl(makeDerivedControl);

export default useDerivedControl;
