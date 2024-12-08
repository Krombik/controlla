import type { AnyAsyncState, LoadableState } from '../types';

const handleUnlisteners = (
  valueUnlistener: () => void,
  state: AnyAsyncState
) => {
  const loadUnlistener =
    state._load && !state._withoutLoading && (state as LoadableState).load();

  return loadUnlistener
    ? () => {
        valueUnlistener();

        loadUnlistener();
      }
    : valueUnlistener;
};

export default handleUnlisteners;
