import { handleSlowLoading, handleUnload } from '#utils/asyncControlUtils';
import type { AsyncControlRoot } from '#_types';

const loadRoot = (
  control: AsyncControlRoot,
  load: () => void | (() => void),
  reload?: boolean
) => {
  const { _reloadOnFocus } = control;

  if (reload && !control._isFetchInProgress) {
    handleUnload(control);

    control._isLoadable = true;
  }

  if (control._isLoadable) {
    control._isLoadable = false;

    handleSlowLoading(control._slowLoading, false);

    if (_reloadOnFocus && _reloadOnFocus._timeoutId != null) {
      clearInterval(_reloadOnFocus._timeoutId);

      _reloadOnFocus._timeoutId = undefined;
    }

    if (control._reloadIfStale && control._reloadIfStale._timeoutId != null) {
      clearInterval(control._reloadIfStale._timeoutId);

      control._reloadIfStale._timeoutId = undefined;
    }

    control._unload = load();
  }

  if (_reloadOnFocus && !_reloadOnFocus._focusListener) {
    const listener = () => {
      if (!document.hidden && _reloadOnFocus._isLoadable) {
        _reloadOnFocus._isLoadable = false;

        loadRoot(control, load, true);
      }
    };

    _reloadOnFocus._focusListener = listener;

    document.addEventListener('visibilitychange', listener);
  }
};

export default loadRoot;
