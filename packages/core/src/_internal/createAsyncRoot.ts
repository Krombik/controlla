import type {
  Mutable,
  AsyncRootNode,
  ChangeListener,
  ErrorControlInternals,
  ReadonlyPrimitiveControlInternals,
  PatchTreeNode,
} from '#internal/types';
import alwaysTrue from '#shared-internal/alwaysTrue';
import initControl from '#internal/initControl';
import readRootValue from '#internal/readRootValue';
import { INTERNALS } from '#shared-internal/constants';
import { handleSlowLoading, handleUnload } from '#internal/asyncLifecycle';
import type {
  AsyncControl,
  LoadableControlOptions,
  Scheduler,
  SyncExternalStorage,
} from '#types';
import triggerLoad from '#internal/triggerLoad';
import alwaysNoop from '#shared-internal/alwaysNoop';
import scheduleMicrotask from '#internal/scheduleMicrotask';
import noop from 'lodash.noop';
import usePrimitiveSync from './usePrimitiveSync';
import useVersionedSync from './useVersionedSync';
import { getLane, scheduleFlush } from './flushQueue';
import runPatching from './runPatching';
import createSubscriber from './createSubscriber';
import { commitPatchNode, UNCHANGED } from './commitPatchNode';

const handleReloadOn = (
  reloadData: NonNullable<AsyncRootNode['_reloadIfStale']>,
  utils: Pick<AsyncRootNode, '_canLoad'>
) => {
  clearTimeout(reloadData._timerId);

  reloadData._timerId = setTimeout(() => {
    utils._canLoad = true;
  }, reloadData._timeoutMs);
};

function attachLoad(this: AsyncRootNode, reload?: boolean) {
  const control = this;

  let isCallable = true;

  control._activeLoadCount++;

  triggerLoad(control, control._load!, reload);

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
}

function asyncEnqueueSet(
  this: AsyncRootNode,
  value: any,
  scheduler: Scheduler,
  path: string[] | undefined
) {
  const lane = getLane(scheduler);

  runPatching(lane, this, value, path);

  if (!path && value !== undefined) {
    const errControl = this._errorControl[INTERNALS];

    const { _patchByControl, _pendingControls } = lane;

    if (!_patchByControl.has(errControl)) {
      _pendingControls.push(errControl);
    }

    _patchByControl.set(errControl, undefined);
  }

  scheduleFlush(lane, scheduler);
}

function errorEnqueueSet(
  this: AsyncRootNode['_errorControl'][typeof INTERNALS],
  value: any,
  scheduler: Scheduler
) {
  const self = this;

  const lane = getLane(scheduler);

  const { _patchByControl, _pendingControls } = lane;

  if (!_patchByControl.has(self)) {
    _pendingControls.push(self);
  }

  _patchByControl.set(self, value);

  if (value !== undefined) {
    runPatching(lane, self._parent, undefined, undefined);
  }

  scheduleFlush(lane, scheduler);
}

const resetLoadingProcess = (control: AsyncRootNode) => {
  control._promise._promise = new Promise((res, rej) => {
    control._promise._resolve = res;

    control._promise._reject = rej;
  });

  handleLoadingStateControls(control, false, undefined);

  if (control._load) {
    if (control._activeLoadCount) {
      triggerLoad(control, control._load, true);
    } else {
      control._canLoad = true;
    }
  }
};

function commitAsyncSet(this: AsyncRootNode, patchNode: PatchTreeNode) {
  const control = this;

  const prevValue = control._value;

  const nextValue = commitPatchNode(patchNode, prevValue, control);

  if (nextValue !== UNCHANGED) {
    control._value = nextValue;

    const callbacks = control._listeners;

    const l = callbacks.length;

    if (l) {
      control._version++;

      for (let i = 0; i < l; i++) {
        callbacks[i](nextValue, prevValue);
      }
    }

    if (nextValue !== undefined) {
      const loaded = control._isLoaded(nextValue, prevValue, control._attempt);

      control._attempt = loaded ? 0 : control._attempt + 1;

      if (loaded) {
        handleLoadedControl(control);
      }

      handleLoadingStateControls(control, !loaded, true);

      control._promise._resolve(nextValue);
    } else if (control._errorControl[INTERNALS]._value === undefined) {
      resetLoadingProcess(control);
    }
  }
}

function commitErrorSet(this: ErrorControlInternals, nextValue: any) {
  const self = this;

  const prevValue = self._value;

  if (prevValue !== nextValue) {
    self._value = nextValue;

    const control = self._parent;

    const callbacks = self._listeners;

    const l = callbacks.length;

    for (let i = 0; i < l; i++) {
      callbacks[i](nextValue, prevValue);
    }

    if (prevValue === undefined) {
      control._attempt = 0;

      handleLoadedControl(control);

      handleLoadingStateControls(control, true, true);

      control._promise._reject(nextValue);
    } else if (nextValue === undefined && control._value === undefined) {
      resetLoadingProcess(control);
    }
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

      if (control._loadingControl[INTERNALS]._value) {
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

const handleLoadingStateControls = (
  control: AsyncRootNode,
  nextLoading: boolean,
  nextReady: true | undefined
) => {
  const loadingControl = control._loadingControl[INTERNALS];

  const readyControl = control._readyControl[INTERNALS];

  const prevLoading = loadingControl._value;

  const prevReady = readyControl._value;

  if (nextLoading != prevLoading) {
    loadingControl._value = nextLoading;

    handleSlowLoading(control._slowLoadMonitor, nextLoading);

    const listeners = loadingControl._listeners;

    const l = listeners.length;

    for (let i = 0; i < l; i++) {
      listeners[i](nextLoading, prevLoading);
    }
  }

  if (nextReady != prevReady) {
    readyControl._value = nextReady;

    const listeners = loadingControl._listeners;

    const l = listeners.length;

    for (let i = 0; i < l; i++) {
      listeners[i](nextReady, prevReady);
    }
  }
};

const handleLoadedControl = (control: AsyncRootNode) => {
  control._canLoad = false;

  handleUnload(control);

  const { _reloadIfStale, _reloadOnFocus } = control;

  if (_reloadIfStale) {
    handleReloadOn(_reloadIfStale, control);
  }

  if (_reloadOnFocus) {
    handleReloadOn(_reloadOnFocus, _reloadOnFocus);
  }
};

const createAsyncRoot = (
  options: Omit<LoadableControlOptions, 'load'>,
  load:
    | OmitThisParameter<LoadableControlOptions<any, any, any, any[]>['load']>
    | undefined,
  keys?: any[],
  syncExternalStorage?: SyncExternalStorage,
  LoadingProcess?: LoadableControlOptions<any, any, any>['LoadingProcess']
): AsyncRootNode => {
  let resolve!: (value: any) => void, reject!: (error: any) => void;

  const { isLoaded, reloadIfStale, reloadOnFocus, loadingTimeout } = options;

  const errorListeners: ChangeListener[] = [];

  const controlListeners: ChangeListener[] = [];

  const loadingListeners: ChangeListener[] = [];

  const readyListeners: ChangeListener[] = [];

  const loadingControl: ReadonlyPrimitiveControlInternals = {
    _value: true,
    _listeners: loadingListeners,
    _get: readRootValue,
    _subscribe: alwaysNoop,
    _useSubscribeWithLoad: usePrimitiveSync,
  };

  const readyControl: ReadonlyPrimitiveControlInternals &
    Pick<AsyncRootNode, '_root'> = {
    _root: undefined!,
    _value: undefined,
    _listeners: readyListeners,
    _get: readRootValue,
    _subscribe: alwaysNoop,
    _useSubscribeWithLoad: usePrimitiveSync,
  };

  const errorControl: ErrorControlInternals = {
    _root: undefined!,
    _subscribe: alwaysNoop,
    _get: readRootValue,
    _enqueueSet: errorEnqueueSet,
    _parent: undefined!,
    _value: undefined,
    _listeners: errorListeners,
    _useSubscribeWithLoad: usePrimitiveSync,
    _commitSet: commitErrorSet,
  };

  const control = initControl<AsyncRootNode>(
    {
      _root: undefined!,
      _isFetchInProgress: false,
      _canLoad: true,
      _activeLoadCount: 0,
      _canScheduleUnload: true,
      _attempt: 0,
      _isLoaded: isLoaded || alwaysTrue,
      _load: alwaysNoop,
      _promise: {
        _promise: new Promise((res, rej) => {
          resolve = res;

          reject = rej;
        }),
        _resolve: resolve,
        _reject: reject,
      },
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
      _listeners: controlListeners,
      _children: undefined,
      _enqueueSet: asyncEnqueueSet,
      _subscribe: alwaysNoop,
      _attachLoad: load ? attachLoad : alwaysNoop,
      _errorControl: { [INTERNALS]: errorControl },
      _loadingControl: { [INTERNALS]: loadingControl },
      _readyControl: { [INTERNALS]: readyControl },
      _loadProcess: undefined!,
      _version: 0,
      _useSubscribeWithLoad: useVersionedSync,
      _useCleanup: noop,
      _path: undefined,
      _storage: undefined,
      _commitSet: commitAsyncSet,
    },
    options.value,
    syncExternalStorage,
    keys
  );

  const innerControl = { [INTERNALS]: control } as AsyncControl;

  const value = control._value;

  (errorControl as Mutable<typeof errorControl>)._root = errorControl;

  (errorControl as Mutable<typeof errorControl>)._parent = control;

  (readyControl as Mutable<typeof readyControl>)._root = control;

  (control as Mutable<typeof control>)._root = control;

  if (load) {
    control._load = keys
      ? load.bind(innerControl, ...keys)
      : load.bind(innerControl);
  }

  if (value !== undefined) {
    const loaded = isLoaded ? isLoaded(value, undefined, 0) : true;

    readyControl._value = true;

    if (loaded) {
      loadingControl._value = false;

      if (!options.revalidate) {
        control._canLoad = false;
      }
    }

    resolve(value);
  }

  if (LoadingProcess) {
    (control as Mutable<typeof control>)._loadProcess = new LoadingProcess(
      options,
      innerControl
    );
  }

  control._subscribe = createSubscriber(controlListeners, control);

  errorControl._subscribe = createSubscriber(errorListeners, control);

  loadingControl._subscribe = createSubscriber(loadingListeners, control);

  readyControl._subscribe = createSubscriber(readyListeners, control);

  return control;
};

export default createAsyncRoot;
