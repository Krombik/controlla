import type {
  Mutable,
  AsyncRootNode,
  ChangeListener,
  ErrorControlInternals,
  ControlInternals,
} from '#internal/types';
import alwaysTrue from '#shared-internal/alwaysTrue';
import initControl from '#internal/initControl';
import readRootValue from '#internal/readRootValue';
import { INTERNALS } from '#shared-internal/constants';
import { handleSlowLoading, handleUnload } from '#internal/asyncLifecycle';
import type {
  AsyncControl,
  LoadableControlOptions,
  SyncExternalStorage,
} from '#types';
import {
  enqueueSet,
  createSubscriber,
  addAfterFlushHook,
  enqueuePrimitiveSet,
} from '#internal/flushQueue';
import triggerLoad from '#internal/triggerLoad';
import alwaysNoop from '#shared-internal/alwaysNoop';
import scheduleMicrotask from '#internal/scheduleMicrotask';

const handleReloadOn = (
  reloadData: NonNullable<AsyncRootNode['_reloadIfStale']>,
  utils: Pick<AsyncRootNode, '_canLoad'>
) => {
  clearTimeout(reloadData._timerId);

  reloadData._timerId = setTimeout(() => {
    utils._canLoad = true;
  }, reloadData._timeoutMs);
};

function readTogglerValue(this: ControlInternals) {
  return this._versionToggle;
}

function asyncEnqueueSet(
  this: AsyncRootNode,
  value: any,
  path?: readonly string[]
) {
  const self = this;

  enqueueSet(self, value, path);

  if (!path && value !== undefined) {
    enqueuePrimitiveSet(self._errorControl[INTERNALS], undefined);
  }
}

function errorEnqueueSet(
  this: AsyncRootNode['_errorControl'][typeof INTERNALS],
  value: any
) {
  const self = this;

  enqueuePrimitiveSet(self, value);

  if (value !== undefined) {
    enqueueSet(self._parent, undefined);
  }
}

const loaderCleanupSet: AsyncRootNode[] = [];

let isLoadCleanupPending = true;

const microtask = () => {
  for (let i = 0; i < loaderCleanupSet.length; i++) {
    const control = loaderCleanupSet[i];

    control._canScheduleUnload = true;

    if (!control._activeLoadCount) {
      handleUnload(control);

      if (control._loadingControl[INTERNALS]._versionToggle) {
        control._canLoad = true;
      }

      if (control._reloadOnFocus) {
        document.removeEventListener(
          'visibilitychange',
          control._reloadOnFocus._visibilityChangeListener!
        );
      }
    }
  }

  loaderCleanupSet.length = 0;

  isLoadCleanupPending = true;
};

const createAsyncRoot = (
  options: Omit<LoadableControlOptions, 'load'>,
  load: LoadableControlOptions<any, any, any, any[]>['load'] | undefined,
  keys?: any[],
  syncExternalStorage?: SyncExternalStorage,
  LoadingProcess?: LoadableControlOptions<any, any, any>['LoadingProcess']
): AsyncRootNode => {
  let resolve!: (value: any) => void, reject!: (error: any) => void;

  const {
    isLoaded = alwaysTrue,
    reloadIfStale,
    reloadOnFocus,
    loadingTimeout,
  } = options;

  const afterFlushHook = () => {
    const newValue = control._value;

    const isSet = newValue !== undefined;

    const isError = errorControl._value !== undefined;

    const ready = isSet || isError || undefined;

    const prevReady = readyControl._versionToggle;

    const loaded = isSet ? isLoaded(newValue, value, attempt) : isError;

    const loading = !loaded;

    value = newValue;

    attempt = loading ? attempt + 1 : 0;

    isAfterFlushHookAddable = true;

    if (loaded) {
      control._canLoad = false;

      handleUnload(control);

      const { _reloadIfStale, _reloadOnFocus } = control;

      if (_reloadIfStale) {
        handleReloadOn(_reloadIfStale, control);
      }

      if (_reloadOnFocus) {
        handleReloadOn(_reloadOnFocus, _reloadOnFocus);
      }

      if (isSet) {
        resolve(newValue);
      } else {
        reject(errorControl._value);
      }
    } else if (!isSet) {
      control._loadPromise = new Promise((res, rej) => {
        resolve = res;

        reject = rej;
      });

      if (load) {
        if (control._activeLoadCount) {
          triggerLoad(control, load, true);
        } else {
          control._canLoad = true;
        }
      }
    }

    if (loading != loadingControl._versionToggle) {
      loadingControl._versionToggle = loading;

      handleSlowLoading(control._slowLoadMonitor, loading);

      const callbacks = loadingControl._listeners;

      const l = callbacks.length;

      for (let i = 0; i < l; i++) {
        callbacks[i](loading, loaded);
      }
    }

    if (ready != prevReady) {
      readyControl._versionToggle = ready!;

      const callbacks = readyControl._listeners;

      const l = callbacks.length;

      for (let i = 0; i < l; i++) {
        callbacks[i](ready, prevReady);
      }
    }
  };

  const cb = () => {
    if (isAfterFlushHookAddable) {
      isAfterFlushHookAddable = false;

      addAfterFlushHook(afterFlushHook);
    }
  };

  const errorCallbacks: ChangeListener[] = [cb];

  const controlCallbacks: ChangeListener[] = [cb];

  const isLoadedCallbacks: ChangeListener[] = [];

  const readyCallbacks: ChangeListener[] = [];

  const loadingControl: ControlInternals = {
    _versionToggle: true,
    _listeners: isLoadedCallbacks,
    _get: readTogglerValue,
    _subscribe: createSubscriber(isLoadedCallbacks, alwaysNoop),
  };

  const readyControl: ControlInternals & Pick<AsyncRootNode, '_root'> = {
    _root: undefined!,
    _versionToggle: undefined!,
    _listeners: readyCallbacks,
    _get: readTogglerValue,
    _subscribe: alwaysNoop,
  };

  const errorControl: ErrorControlInternals = {
    _root: undefined!,
    _subscribe: createSubscriber(errorCallbacks, alwaysNoop),
    _get: readRootValue,
    _enqueueSet: errorEnqueueSet,
    _parent: undefined!,
    _value: undefined,
    _listeners: errorCallbacks,
    _versionToggle: true,
    _nextValue: undefined,
    _stale: true,
  };

  const control = initControl<AsyncRootNode>(
    {
      _root: undefined!,
      _isFetchInProgress: false,
      _canLoad: true,
      _activeLoadCount: 0,
      _canScheduleUnload: true,
      _loadPromise: new Promise((res, rej) => {
        resolve = res;

        reject = rej;
      }),
      _cleanup: undefined,
      _value: undefined,
      _reloadIfStale: reloadIfStale
        ? { _timeoutMs: reloadIfStale, _timerId: undefined }
        : null,
      _reloadOnFocus: reloadOnFocus
        ? {
            _timeoutMs: reloadOnFocus,
            _timerId: undefined,
            _visibilityChangeListener: undefined,
            _canLoad: false,
          }
        : null,
      _slowLoadMonitor: loadingTimeout
        ? {
            _timeoutMs: loadingTimeout,
            _timerId: undefined,
            _listeners: [],
            _listenerIndex: new Map(),
          }
        : null,
      _get: readRootValue,
      _listeners: controlCallbacks,
      _children: undefined,
      _enqueueSet: asyncEnqueueSet,
      _subscribe: alwaysNoop,
      _attachLoad: alwaysNoop,
      _errorControl: { [INTERNALS]: errorControl },
      _loadingControl: { [INTERNALS]: loadingControl },
      _readyControl: { [INTERNALS]: readyControl },
      _loadProcess: undefined!,
      _versionToggle: true,
      _unobserve: undefined,
      _patchNode: {
        _children: new Map(),
        _patchedKeys: [],
        _isObject: true,
        _prevValue: undefined,
        _hasValuePatch: false,
        _value: undefined,
      },
      _path: undefined,
      _stale: true,
      _storage: undefined,
    },
    options.value,
    syncExternalStorage,
    keys
  );

  const innerControl = { [INTERNALS]: control } as AsyncControl;

  let value = control._value;

  let isAfterFlushHookAddable = true;

  let attempt = 0;

  (errorControl as Mutable<typeof errorControl>)._root = errorControl;

  (errorControl as Mutable<typeof errorControl>)._parent = control;

  (readyControl as Mutable<typeof readyControl>)._root = control;

  (control as Mutable<typeof control>)._root = control;

  if (load) {
    load = keys ? load.bind(innerControl, ...keys) : load.bind(innerControl);

    control._attachLoad = (reload) => {
      let isCallable = true;

      control._activeLoadCount++;

      triggerLoad(control, load!, reload);

      return () => {
        if (isCallable) {
          isCallable = false;

          if (!--control._activeLoadCount && control._canScheduleUnload) {
            loaderCleanupSet.push(control);

            control._canScheduleUnload = false;

            if (isLoadCleanupPending) {
              isLoadCleanupPending = false;

              scheduleMicrotask(microtask);
            }
          }
        }
      };
    };
  }

  if (value !== undefined) {
    const loaded = isLoaded(value, undefined, 0);

    readyControl._versionToggle = true;

    if (loaded) {
      loadingControl._versionToggle = false;

      resolve(value);

      if (!options.revalidate) {
        control._canLoad = false;
      }
    }
  }

  if (LoadingProcess) {
    (control as Mutable<typeof control>)._loadProcess = new LoadingProcess(
      options,
      innerControl
    );
  }

  control._subscribe = createSubscriber(controlCallbacks, control._attachLoad);

  readyControl._subscribe = createSubscriber(
    readyCallbacks,
    control._attachLoad
  );

  return control;
};

export default createAsyncRoot;
