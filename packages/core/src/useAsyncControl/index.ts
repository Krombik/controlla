import createAsyncControl from '#@/createAsyncControl';
import makeUseControl from '#internal/makeUseControl';

const useAsyncControl: typeof createAsyncControl =
  makeUseControl(createAsyncControl);

export default useAsyncControl;
