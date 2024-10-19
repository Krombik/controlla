import type {
  AnyAsyncState,
  AsyncState,
  AsyncStateUtils,
  ControllableLoadableState,
  ControllableLoadableStateOptions,
  ErrorStateUtils,
  StateInitializer,
  PathKey,
} from '../types';
import { EMPTY_ARR } from './constants';
import executeSetters from './executeSetters';
import createState from '../createState';
import alwaysTrue from './alwaysTrue';

type _State = AsyncState<any> &
  Partial<Omit<ControllableLoadableState, keyof AsyncState<any>>>;

type _InternalUtils = _State['_internal'];

const handleUnload = (utils: _InternalUtils) => {
  if (utils._unload) {
    utils._unload = utils._unload();
  }
};

const handleReloadOn = (
  reloadData: NonNullable<_InternalUtils['_reloadIfStale']>,
  utils: { _isLoadable: boolean }
) => {
  clearTimeout(reloadData._timeoutId);

  reloadData._timeoutId = setTimeout(() => {
    utils._isLoadable = true;
  }, reloadData._timeout);
};

function _set(
  this: _InternalUtils,
  value: any,
  path: PathKey[],
  isError: boolean
) {
  const prevValue = this._value;

  this._isFetchInProgress = false;

  this._commonSet(value, path);

  const newValue = this._value;

  const isSet = newValue !== undefined;

  const isLoaded = isSet
    ? this._isLoaded(newValue, prevValue, this._attempt)
    : isError;

  if (this._attempt != null) {
    if (isLoaded) {
      this._attempt = 0;
    } else {
      this._attempt++;
    }
  }

  this._isLoadedUtils._set(isLoaded, path);

  if (isLoaded) {
    this._isLoadable = false;

    handleUnload(this);

    const { _reloadIfStale, _reloadOnFocus } = this;

    if (_reloadIfStale) {
      handleReloadOn(_reloadIfStale, this);
    }

    if (_reloadOnFocus) {
      handleReloadOn(_reloadOnFocus, _reloadOnFocus);
    }
  }

  if (!isError) {
    this._errorUtils._set(undefined, path);

    if (isSet && this._promise) {
      this._promise._resolve(newValue);

      this._promise = null;
    }
  }

  if (this._slowLoading) {
    this._slowLoading._handle(this._isLoadedUtils);
  }
}

function _handleSlowLoading(
  this: NonNullable<_InternalUtils['_slowLoading']>,
  isLoadedUtils: _InternalUtils['_isLoadedUtils']
) {
  clearTimeout(this._timeoutId);

  this._timeoutId = isLoadedUtils._value
    ? undefined
    : setTimeout(() => {
        executeSetters(this._callbackSet);
      }, this._timeout);
}

function _setError(this: _InternalUtils['_errorUtils'], value: any) {
  this._commonSet(value, EMPTY_ARR);

  if (value !== undefined) {
    const parentUtils = this._parentUtils;

    parentUtils._set(undefined, EMPTY_ARR, true);

    if (parentUtils._promise) {
      parentUtils._promise._reject(value);

      parentUtils._promise = null;
    }
  }
}

function load(this: _State, reload?: boolean) {
  let isNotCanceled = true;

  const utils = this._internal;

  const { _reloadOnFocus } = utils;

  if (reload && !utils._isFetchInProgress) {
    handleUnload(utils);

    utils._isLoadable = true;
  }

  if (utils._isLoadable) {
    utils._isLoadable = false;

    utils._isLoadedUtils._set(false, EMPTY_ARR);

    if (utils._slowLoading) {
      utils._slowLoading._handle(utils._isLoadedUtils);
    }

    if (_reloadOnFocus && _reloadOnFocus._timeoutId != null) {
      clearInterval(_reloadOnFocus._timeoutId);

      _reloadOnFocus._timeoutId = undefined;
    }

    if (utils._reloadIfStale && utils._reloadIfStale._timeoutId != null) {
      clearInterval(utils._reloadIfStale._timeoutId);

      utils._reloadIfStale._timeoutId = undefined;
    }

    const unload = utils._load!.apply(
      { ...this, _path: EMPTY_ARR },
      (this.keys as any) || EMPTY_ARR
    );

    if (unload) {
      utils._unload = unload;
    }
  }

  if (_reloadOnFocus && !_reloadOnFocus._focusListener) {
    const listener = () => {
      if (!document.hidden && _reloadOnFocus._isLoadable) {
        _reloadOnFocus._isLoadable = false;

        this.load!(true)();
      }
    };

    _reloadOnFocus._focusListener = listener;

    document.addEventListener('visibilitychange', listener);
  }

  utils._counter++;

  return () => {
    if (isNotCanceled) {
      isNotCanceled = false;

      if (!--utils._counter) {
        handleUnload(utils);

        if (!utils._isLoadedUtils._value) {
          utils._isLoadable = true;
        }

        if (utils._reloadOnFocus) {
          document.removeEventListener(
            'visibilitychange',
            utils._reloadOnFocus._focusListener!
          );
        }
      }
    }
  };
}

const getAsyncStateCreator =
  (createCommonState: typeof createState) =>
  (
    {
      value,
      isLoaded,
      load: _load,
      pause,
      resume,
      loadingTimeout,
      reset,
      reloadIfStale,
      reloadOnFocus,
    }: Partial<ControllableLoadableStateOptions<any>>,
    stateInitializer?: StateInitializer,
    keys?: any[],
    parentUtils?: Record<string, any>
  ): AnyAsyncState<any> => {
    const errorState = createState<ErrorStateUtils>(
      undefined,
      undefined,
      undefined,
      {
        _commonSet: undefined!,
        _parentUtils: undefined!,
      }
    );

    const errorUtils = errorState._internal;

    const isLoadedState = createState(false);

    const state = {
      ...createCommonState<AsyncStateUtils>(value, stateInitializer, keys, {
        _commonSet: undefined!,
        _isLoaded: isLoaded || alwaysTrue,
        _slowLoading: loadingTimeout
          ? {
              _timeout: loadingTimeout,
              _timeoutId: undefined,
              _callbackSet: new Set(),
              _handle: _handleSlowLoading,
            }
          : null,
        _counter: 0,
        _isFetchInProgress: false,
        _isLoadable: true,
        _load,
        _isLoadedUtils: isLoadedState._internal,
        _errorUtils: errorUtils,
        _promise: null,
        _unload: undefined,
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
        ...parentUtils,
      }),
      error: errorState,
      isLoaded: isLoadedState,
    } as _State;

    const utils = state._internal;

    utils._commonSet = utils._set;

    utils._set = _set;

    errorUtils._commonSet = errorUtils._set;

    errorUtils._set = _setError;

    errorUtils._parentUtils = utils;

    if (utils._value !== undefined) {
      utils._isLoadable = false;
    }

    return _load
      ? pause && resume && reset
        ? { ...state, load, pause, resume, reset }
        : {
            ...state,
            load,
          }
      : state;
  };

export default getAsyncStateCreator;
