import noop from 'lodash.noop';
import type { InternalAsyncControl } from '#_types';
import { ROOT } from '#shared/constants';
import { handleSlowLoading, handleUnload } from '#utils/asyncControlUtils';
import scheduleMicrotask from '#utils/scheduleMicrotask';
import type { LoadableControl } from '#types';

const loaderCleanupSet = new Set<InternalAsyncControl>();

let isLoadCleanupPending = true;

const startBatch = () => {
  if (isLoadCleanupPending) {
    isLoadCleanupPending = false;

    scheduleMicrotask(() => {
      const it = loaderCleanupSet.values();

      for (let i = loaderCleanupSet.size; i--; ) {
        const control: InternalAsyncControl = it.next().value;

        handleUnload(control);

        if (!control._isLoadedControl[ROOT]._value) {
          control._isLoadable = true;
        }

        if (control._reloadOnFocus) {
          document.removeEventListener(
            'visibilitychange',
            control._reloadOnFocus._focusListener!
          );
        }
      }

      loaderCleanupSet.clear();

      isLoadCleanupPending = true;
    });
  }
};

const load: {
  (control: LoadableControl<any, any, any>, reload?: boolean): () => void;
  /** @internal */
  (control: InternalAsyncControl, reload?: boolean): () => void;
} = (
  control: LoadableControl<any, any, any> | InternalAsyncControl,
  reload?: boolean
) => {
  const self = control[ROOT][ROOT];

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

    self._isLoadedControl[ROOT]._set(false);

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
