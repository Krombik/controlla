import { handleSlowLoading, handleUnload } from '#internal/asyncLifecycle';
import type { AsyncRootNode } from '#internal/types';

const triggerLoad = (
  control: AsyncRootNode,
  load: () => void | (() => void),
  reload?: boolean
) => {
  const { _reloadOnFocus } = control;

  if (reload && !control._isFetchInProgress) {
    handleUnload(control);

    control._canLoad = true;
  }

  if (control._canLoad) {
    control._canLoad = false;

    handleSlowLoading(control._slowLoadMonitor, false);

    if (_reloadOnFocus && _reloadOnFocus._timerId != null) {
      clearInterval(_reloadOnFocus._timerId);

      _reloadOnFocus._timerId = undefined;
    }

    if (control._reloadIfStale && control._reloadIfStale._timerId != null) {
      clearInterval(control._reloadIfStale._timerId);

      control._reloadIfStale._timerId = undefined;
    }

    control._cleanup = load();
  }

  if (_reloadOnFocus && !_reloadOnFocus._visibilityChangeListener) {
    const listener = () => {
      if (!document.hidden && _reloadOnFocus._canLoad) {
        _reloadOnFocus._canLoad = false;

        triggerLoad(control, load, true);
      }
    };

    _reloadOnFocus._visibilityChangeListener = listener;

    document.addEventListener('visibilitychange', listener);
  }
};

export default triggerLoad;
