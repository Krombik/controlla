import createPrimitiveControl from '#core/createPrimitiveControl';
import makeUseControl from '#internal/makeUseControl';

const usePrimitiveControl: typeof createPrimitiveControl = makeUseControl(
  createPrimitiveControl
);

export default usePrimitiveControl;
