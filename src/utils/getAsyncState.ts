import type {
  AnyAsyncState,
  AsyncState,
  ErrorState,
  IsLoadedState,
  LoadableState,
  LoadableStateOptions,
  Mutable,
  StateInitializer,
} from '../types';
import alwaysTrue from './alwaysTrue';
import { addToBatch } from './batching';
import executeSetters from './executeSetters';
import handleState from './handleState';
import { _onValueChange } from './state/common';

const handleReloadOn = (
  reloadData: NonNullable<AsyncState['_internal']['_reloadIfStale']>,
  utils: { _isLoadable: boolean }
) => {
  clearTimeout(reloadData._timeoutId);

  reloadData._timeoutId = setTimeout(() => {
    utils._isLoadable = true;
  }, reloadData._timeout);
};

const handleUnload = (data: AsyncState['_internal']) => {
  if (data._unload) {
    data._unload = data._unload();
  }
};

const handleSlowLoading = (
  slowLoading: AsyncState['_internal']['_slowLoading'],
  isLoaded: boolean
) => {
  if (slowLoading) {
    clearTimeout(slowLoading._timeoutId);

    slowLoading._timeoutId = isLoaded
      ? undefined
      : setTimeout(() => {
          executeSetters(slowLoading._callbackSet);
        }, slowLoading._timeout);
  }
};

function set(this: AsyncState, value: any, isError?: boolean) {
  const self = this;

  const data = self._internal;

  const prevRootValue = data._value;

  self._commonSet(value);

  const newRootValue = data._value;

  const isSet = newRootValue !== undefined;

  const isLoaded = isSet
    ? data._isLoaded(newRootValue, prevRootValue, data._attempt)
    : isError || false;

  if (data._attempt != null) {
    if (isLoaded) {
      data._attempt = 0;
    } else {
      data._attempt++;
    }
  }

  self.isLoaded._set(isLoaded);

  if (isLoaded) {
    data._isLoadable = false;

    handleUnload(data);

    const { _reloadIfStale, _reloadOnFocus } = data;

    if (_reloadIfStale) {
      handleReloadOn(_reloadIfStale, data);
    }

    if (_reloadOnFocus) {
      handleReloadOn(_reloadOnFocus, _reloadOnFocus);
    }
  }

  if (!isError) {
    self.error.set(undefined);

    if (isSet && data._promise) {
      data._promise._resolve(newRootValue);

      data._promise = null;
    }
  }

  handleSlowLoading(data._slowLoading, isLoaded);
}

function load(this: LoadableState, reload?: boolean) {
  let isNotCanceled = true;

  const self = this;

  const data = self._internal;

  const { _reloadOnFocus } = data;

  if (reload && !data._isFetchInProgress) {
    handleUnload(data);

    data._isLoadable = true;
  }

  if (data._isLoadable) {
    data._isLoadable = false;

    self.isLoaded._set(false);

    handleSlowLoading(data._slowLoading, false);

    if (_reloadOnFocus && _reloadOnFocus._timeoutId != null) {
      clearInterval(_reloadOnFocus._timeoutId);

      _reloadOnFocus._timeoutId = undefined;
    }

    if (data._reloadIfStale && data._reloadIfStale._timeoutId != null) {
      clearInterval(data._reloadIfStale._timeoutId);

      data._reloadIfStale._timeoutId = undefined;
    }

    const keys = this._keys;

    const unload = keys ? self._load(...keys) : self._load();

    if (unload) {
      data._unload = unload;
    }
  }

  if (_reloadOnFocus && !_reloadOnFocus._focusListener) {
    const listener = () => {
      if (!document.hidden && _reloadOnFocus._isLoadable) {
        _reloadOnFocus._isLoadable = false;

        self.load!(true)();
      }
    };

    _reloadOnFocus._focusListener = listener;

    document.addEventListener('visibilitychange', listener);
  }

  data._counter++;

  return () => {
    if (isNotCanceled) {
      isNotCanceled = false;

      if (!--data._counter) {
        handleUnload(data);

        if (!self.isLoaded._value) {
          data._isLoadable = true;
        }

        if (data._reloadOnFocus) {
          document.removeEventListener(
            'visibilitychange',
            data._reloadOnFocus._focusListener!
          );
        }
      }
    }
  };
}

function setInner(this: IsLoadedState, value: any) {
  const self = this;

  if (self._value !== value) {
    self._value = value;

    addToBatch(self._setData, value);
  }
}

function getInner(this: IsLoadedState) {
  return this._value;
}

function setError(this: ErrorState<any>, value: any) {
  const self = this;

  if (self._value !== value) {
    self._value = value;

    addToBatch(self._setData, value);

    if (value !== undefined) {
      const parent = self._parent;

      const parentData = parent._internal;

      parent.set(undefined, true);

      if (parentData._promise) {
        parentData._promise._reject(value);

        parentData._promise = null;
      }
    }
  }
}

function getError(this: ErrorState<any>) {
  const self = this;

  const err = self._value;

  if (err === undefined || self._isExpectedError!(err)) {
    return err;
  }

  throw err;
}

const getAsyncState = <D>(
  get: LoadableState['get'],
  _commonSet: LoadableState['_commonSet'],
  onValueChange: LoadableState['_onValueChange'],
  options: Omit<LoadableStateOptions, 'load'>,
  stateInitializer: StateInitializer | undefined,
  _keys: any[] | undefined,
  _setData: D,
  _load?: LoadableStateOptions['load'],
  Control?: LoadableStateOptions<any, any, any>['Control']
): AnyAsyncState => {
  const {
    isExpectedError,
    isLoaded,
    reloadIfStale,
    reloadOnFocus,
    loadingTimeout,
  } = options;

  const errorState: ErrorState<any> = {
    _onValueChange,
    get: isExpectedError ? getError : getInner,
    set: setError,
    _isExpectedError: isExpectedError,
    _parent: undefined!,
    _value: undefined,
    _setData: new Set(),
  };

  const state = handleState<LoadableState<any, any, any>>(
    {
      _internal: {
        _isFetchInProgress: false,
        _isLoadable: true,
        _counter: 0,
        _isLoaded: isLoaded || alwaysTrue,
        _promise: null,
        _unload: undefined,
        _value: undefined,
        _attempt: isLoaded && isLoaded.length > 2 ? 0 : undefined,
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
              _callbackSet: new Set(),
            }
          : null,
      },
      get,
      _setData,
      set,
      _commonSet,
      _onValueChange: onValueChange,
      load,
      _load: _load!,
      error: errorState,
      isLoaded: {
        _onValueChange,
        get: getInner,
        _set: setInner,
        _value: false,
        _setData: new Set(),
      },
      control: undefined!,
      _keys,
    },
    options.value,
    stateInitializer,
    _keys
  );

  const value = state._internal._value;

  (errorState as Mutable<typeof errorState>)._parent = state;

  if (value !== undefined) {
    const _isLoaded = isLoaded ? isLoaded(value, undefined, 0) : true;

    state.isLoaded._value = _isLoaded;

    if (_isLoaded && !options.revalidate) {
      state._internal._isLoadable = false;
    }
  }

  if (Control) {
    (state as Mutable<typeof state>).control = new Control(options, state);
  }

  return state;
};

export default getAsyncState;
