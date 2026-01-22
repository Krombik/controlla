import type {
  Mutable,
  AsyncControlRoot,
  OnValueChange,
  ErrorUtils,
  SharedPrimitiveControl,
} from '#_types';
import alwaysTrue from '#shared/alwaysTrue';
import handleControl from '#utils/handleControl';
import rootGet from '#utils/rootGet';
import { ROOT } from '#shared/constants';
import { handleSlowLoading, handleUnload } from '#utils/asyncControlUtils';
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
} from '#utils/batching';
import loadRoot from '#utils/loadRoot';
import alwaysNoop from '#shared/alwaysNoop';
import scheduleMicrotask from '#utils/scheduleMicrotask';

const handleReloadOn = (
  reloadData: NonNullable<AsyncControlRoot['_reloadIfStale']>,
  utils: { _isLoadable: boolean }
) => {
  clearTimeout(reloadData._timeoutId);

  reloadData._timeoutId = setTimeout(() => {
    utils._isLoadable = true;
  }, reloadData._timeout);
};

function asyncEnqueueSet(
  this: AsyncControlRoot,
  value: any,
  path?: readonly string[]
) {
  const self = this;

  enqueueSet(self, value, path);

  if (!path && value !== undefined) {
    enqueuePrimitiveSet(self._errorControl[ROOT], undefined);
  }
}

function errorEnqueueSet(
  this: AsyncControlRoot['_errorControl'][typeof ROOT],
  value: any
) {
  const self = this;

  enqueuePrimitiveSet(self, value);

  if (value !== undefined) {
    enqueueSet(self._parent, undefined);
  }
}

const loaderCleanupSet: AsyncControlRoot[] = [];

let isLoadCleanupPending = true;

const microtask = () => {
  for (let i = 0; i < loaderCleanupSet.length; i++) {
    const control = loaderCleanupSet[i];

    control._isUnloadNotSchedule = true;

    if (!control._counter) {
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
  }

  loaderCleanupSet.length = 0;

  isLoadCleanupPending = true;
};

const getAsyncControl = (
  options: Omit<LoadableControlOptions, 'load'>,
  load: LoadableControlOptions<any, any, any, any[]>['load'] | undefined,
  keys?: any[],
  syncExternalStorage?: SyncExternalStorage,
  LoadingProcess?: LoadableControlOptions<any, any, any>['LoadingProcess']
): AsyncControlRoot => {
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

    const loaded = isSet
      ? isLoaded(newValue, value, attempt!)
      : errorControl._value !== undefined;

    value = undefined;

    attempt = loaded ? 0 : attempt + 1;

    if (loaded) {
      control._isLoadable = false;

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
      control._promise = new Promise((res, rej) => {
        resolve = res;

        reject = rej;
      });

      if (load) {
        if (control._counter) {
          loadRoot(control, load, true);
        } else {
          control._isLoadable = true;
        }
      }
    }

    if (loaded != isLoadedControl._value) {
      isLoadedControl._value = loaded;

      handleSlowLoading(control._slowLoading, loaded);

      const callbacks = isLoadedControl._callbacks;

      const l = callbacks.length;

      if (l) {
        const prev = !loaded;

        isLoadedControl._valueToggler = !isLoadedControl._valueToggler;

        for (let i = 0; i < l; i++) {
          callbacks[i](loaded, prev);
        }
      }
    }
  };

  const errorCallbacks: OnValueChange[] = [
    () => {
      if (isAfterFlushHookAddable) {
        isAfterFlushHookAddable = false;

        addAfterFlushHook(afterFlushHook);
      }
    },
  ];

  const controlCallbacks: OnValueChange[] = [
    (_, prevValue) => {
      value = prevValue;

      if (isAfterFlushHookAddable) {
        isAfterFlushHookAddable = false;

        addAfterFlushHook(afterFlushHook);
      }
    },
  ];

  const isLoadedCallbacks: OnValueChange[] = [];

  const isLoadedControl: SharedPrimitiveControl = {
    _value: false,
    _valueToggler: true,
    _callbacks: isLoadedCallbacks,
    _get: rootGet,
    _subscribe: createSubscriber(isLoadedCallbacks, alwaysNoop),
  };

  const errorControl: ErrorUtils = {
    _root: undefined!,
    _subscribe: createSubscriber(errorCallbacks, alwaysNoop),
    _get: rootGet,
    _enqueueSet: errorEnqueueSet,
    _parent: undefined!,
    _value: undefined,
    _callbacks: errorCallbacks,
    _valueToggler: true,
    _nextValue: undefined,
    _stale: true,
  };

  const control = handleControl<AsyncControlRoot>(
    {
      _root: undefined!,
      _isFetchInProgress: false,
      _watchValueChanges: true,
      _isLoadable: true,
      _counter: 0,
      _isUnloadNotSchedule: true,
      _promise: new Promise((res, rej) => {
        resolve = res;

        reject = rej;
      }),
      _unload: undefined,
      _value: undefined,
      _reloadIfStale: reloadIfStale
        ? { _timeout: reloadIfStale, _timeoutId: undefined }
        : null,
      _reloadOnFocus: reloadOnFocus
        ? {
            _timeout: reloadOnFocus,
            _timeoutId: undefined,
            _focusListener: undefined,
            _isLoadable: false,
          }
        : null,
      _slowLoading: loadingTimeout
        ? {
            _timeout: loadingTimeout,
            _timeoutId: undefined,
            _callbacks: [],
            _indexMap: new Map(),
          }
        : null,
      _get: rootGet,
      _callbacks: controlCallbacks,
      _children: undefined,
      _enqueueSet: asyncEnqueueSet,
      _subscribe: alwaysNoop,
      _load: alwaysNoop,
      _errorControl: { [ROOT]: errorControl },
      _isLoadedControl: { [ROOT]: isLoadedControl },
      _loadingProcess: undefined!,
      _valueToggler: true,
      _unobserve: undefined,
      _patchNode: {
        _children: new Map(),
        _childrenKeys: [],
        _isObject: true,
        _prevValue: undefined,
        _set: false,
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

  const innerControl = { [ROOT]: control } as AsyncControl;

  let value = control._value;

  let isAfterFlushHookAddable = true;

  let attempt = 0;

  (errorControl as Mutable<typeof errorControl>)._root = errorControl;

  (errorControl as Mutable<typeof errorControl>)._parent = control;

  (control as Mutable<typeof control>)._root = control;

  if (load) {
    load = keys ? load.bind(innerControl, ...keys) : load.bind(innerControl);

    control._load = (reload) => {
      let isCallable = true;

      control._counter++;

      loadRoot(control, load!, reload);

      return () => {
        if (isCallable) {
          isCallable = false;

          if (!--control._counter && control._isUnloadNotSchedule) {
            loaderCleanupSet.push(control);

            control._isUnloadNotSchedule = false;

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

    isLoadedControl._value = loaded;

    if (loaded) {
      resolve(value);

      if (!options.revalidate) {
        control._isLoadable = false;
      }
    }
  }

  if (LoadingProcess) {
    (control as Mutable<typeof control>)._loadingProcess = new LoadingProcess(
      options,
      innerControl
    );
  }

  control._subscribe = createSubscriber(controlCallbacks, control._load);

  return control;
};

export default getAsyncControl;
