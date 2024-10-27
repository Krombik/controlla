import { AnyAsyncState } from '../types';

const handleUnlisteners = (
  valueUnlistener: () => void,
  state: AnyAsyncState
) => {
  const loadUnlistener =
    'load' in state && !state._withoutLoading && state.load();

  return loadUnlistener
    ? () => {
        valueUnlistener();

        loadUnlistener();
      }
    : valueUnlistener;
};

export default handleUnlisteners;
