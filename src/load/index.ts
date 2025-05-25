import noop from 'lodash.noop';
import type { InternalAsyncState, LoadableState } from '../types';
import { RESOLVED_PROMISE, ROOT } from '../utils/constants';
import { handleSlowLoading, handleUnload } from '../utils/asyncStateUtils';

const loaderCleanupSet = new Set<InternalAsyncState>();

let isLoadCleanupPending = true;

const startBatch = () => {
  if (isLoadCleanupPending) {
    isLoadCleanupPending = false;

    RESOLVED_PROMISE.then(() => {
      const it = loaderCleanupSet.values();

      for (let i = loaderCleanupSet.size; i--; ) {
        const state: InternalAsyncState = it.next().value;

        handleUnload(state);

        if (!state._isLoadedState[ROOT]._value) {
          state._isLoadable = true;
        }

        if (state._reloadOnFocus) {
          document.removeEventListener(
            'visibilitychange',
            state._reloadOnFocus._focusListener!
          );
        }
      }

      loaderCleanupSet.clear();

      isLoadCleanupPending = true;
    });
  }
};

const load: {
  (state: LoadableState, reload?: boolean): () => void;
  /** @internal */
  (state: InternalAsyncState, reload?: boolean): () => void;
} = (state: LoadableState | InternalAsyncState, reload?: boolean) => {
  const self = state[ROOT][ROOT];

  const { _reloadOnFocus } = self;

  let cleanup = () => {
    cleanup = noop;

    if (!--self._counter) {
      loaderCleanupSet.add(self);

      startBatch();
    }
  };

  if (reload && !self._isFetchInProgress) {
    handleUnload(self);

    self._isLoadable = true;
  }

  if (self._isLoadable) {
    self._isLoadable = false;

    self._isLoadedState[ROOT]._set(false);

    handleSlowLoading(self._slowLoading, false);

    if (_reloadOnFocus && _reloadOnFocus._timeoutId != null) {
      clearInterval(_reloadOnFocus._timeoutId);

      _reloadOnFocus._timeoutId = undefined;
    }

    if (self._reloadIfStale && self._reloadIfStale._timeoutId != null) {
      clearInterval(self._reloadIfStale._timeoutId);

      self._reloadIfStale._timeoutId = undefined;
    }

    const keys = self._keys;

    const unload = keys ? self._load!(...keys) : self._load!();

    if (unload) {
      self._unload = unload;
    }
  }

  if (_reloadOnFocus && !_reloadOnFocus._focusListener) {
    const listener = () => {
      if (!document.hidden && _reloadOnFocus._isLoadable) {
        _reloadOnFocus._isLoadable = false;

        load(self, true)();
      }
    };

    _reloadOnFocus._focusListener = listener;

    document.addEventListener('visibilitychange', listener);
  }

  if (!self._counter++) {
    loaderCleanupSet.delete(self);
  }

  return () => {
    cleanup();
  };
};

export default load;
