import load from '../load';
import type { AnyAsyncState, LoadableState } from '../types';

const handleUnlisteners = (
  valueUnlistener: () => void,
  state: AnyAsyncState
) => {
  const loadUnlistener: undefined | (() => void) = load(state as LoadableState);

  return loadUnlistener
    ? () => {
        valueUnlistener();

        loadUnlistener();
      }
    : valueUnlistener;
};

export default handleUnlisteners;
