import type { AnyAsyncState, LoadableState } from '../types';

const handleUnlisteners = (
  valueUnlistener: () => void,
  state: AnyAsyncState
) => {
  const loadUnlistener: undefined | (() => void) =
    (state as LoadableState).load && (state as LoadableState).load();

  return loadUnlistener
    ? () => {
        valueUnlistener();

        loadUnlistener();
      }
    : valueUnlistener;
};

export default handleUnlisteners;
