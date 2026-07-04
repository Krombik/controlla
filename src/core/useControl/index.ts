import createControl from '#core/createControl';
import makeUseControl from '#internal/makeUseControl';

const useControl: typeof createControl = makeUseControl(createControl);

export default useControl;
