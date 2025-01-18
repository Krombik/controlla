import noop from 'lodash.noop';
import type {
  ValueChangeCallbacks,
  AnyAsyncState,
  AsyncState,
  ErrorState,
  LoadableState,
  LoadableStateOptions,
  Mutable,
  PaginatedStorage,
  StateInitializer,
} from '../types';
import alwaysTrue from './alwaysTrue';
import { addToBatch } from './batching';
import executeSetters from './executeSetters';
import handleState from './handleState';
import { get } from './state/common';
import createSimpleState from './createSimpleState';
import createSubscribe from './createSubscribe';
import alwaysNoop from './alwaysNoop';
import {
  createLoadableSubscribe,
  createSubscribeWithError,
} from './createAsyncSubscribe';

const handleReloadOn = (
  reloadData: NonNullable<AsyncState['_reloadIfStale']>,
  utils: { _isLoadable: boolean }
) => {
  clearTimeout(reloadData._timeoutId);

  reloadData._timeoutId = setTimeout(() => {
    utils._isLoadable = true;
  }, reloadData._timeout);
};

const handleUnload = (data: AsyncState) => {
  if (data._unload) {
    data._unload = data._unload();
  }
};

const handleSlowLoading = (
  slowLoading: AsyncState['_slowLoading'],
  isLoaded: boolean
) => {
  if (slowLoading) {
    clearTimeout(slowLoading._timeoutId);

    slowLoading._timeoutId = isLoaded
      ? undefined
      : setTimeout(() => {
          executeSetters(slowLoading._callbacks);
        }, slowLoading._timeout);
  }
};

function set(
  this: AsyncState,
  value: any,
  path?: readonly string[],
  isError?: boolean
) {
  const self = this;

  const prevRootValue = self._value;

  self._commonSet(value, path);

  self._tickEnd();

  const newRootValue = self._value;

  const isSet = newRootValue !== undefined;

  const isLoaded = isSet
    ? self._isLoaded(newRootValue, prevRootValue, self._attempt)
    : isError || false;

  if (self._attempt != null) {
    if (isLoaded) {
      self._attempt = 0;
    } else {
      self._attempt++;
    }
  }

  self.isLoaded.set(isLoaded);

  if (isLoaded) {
    self._isLoadable = false;

    handleUnload(self);

    const { _reloadIfStale, _reloadOnFocus } = self;

    if (_reloadIfStale) {
      handleReloadOn(_reloadIfStale, self);
    }

    if (_reloadOnFocus) {
      handleReloadOn(_reloadOnFocus, _reloadOnFocus);
    }
  }

  if (!isError) {
    self.error.set(undefined);

    if (isSet && self._promise) {
      self._promise._resolve(newRootValue);

      self._promise = null;
    }
  }

  handleSlowLoading(self._slowLoading, isLoaded);
}

function load(this: LoadableState, reload?: boolean) {
  let isNotCanceled = true;

  const self = this;

  const { _reloadOnFocus } = self;

  if (reload && !self._isFetchInProgress) {
    handleUnload(self);

    self._isLoadable = true;
  }

  if (self._isLoadable) {
    self._isLoadable = false;

    self.isLoaded.set(false);

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

        self.load(true)();
      }
    };

    _reloadOnFocus._focusListener = listener;

    document.addEventListener('visibilitychange', listener);
  }

  self._counter++;

  return () => {
    if (isNotCanceled) {
      isNotCanceled = false;

      if (!--self._counter) {
        handleUnload(self);

        if (!self.isLoaded._value) {
          self._isLoadable = true;
        }

        if (self._reloadOnFocus) {
          document.removeEventListener(
            'visibilitychange',
            self._reloadOnFocus._focusListener!
          );
        }
      }
    }
  };
}

function setError(this: ErrorState<any>, value: any) {
  const self = this;

  if (self._value !== value) {
    self._value = value;

    addToBatch(self, value);

    if (value !== undefined) {
      const parent = self._parent;

      parent.set(undefined, undefined, true);

      if (parent._promise) {
        parent._promise._reject(value);

        parent._promise = null;
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

const getAsyncState = (
  _commonSet: LoadableState['_commonSet'],
  options: Omit<LoadableStateOptions, 'load'>,
  stateInitializer: StateInitializer | undefined,
  _keys: any[] | undefined,
  _load?: LoadableStateOptions<any, any, any, any[]>['load'],
  Control?: LoadableStateOptions<any, any, any>['Control'],
  _tickStart?: () => void,
  _tickEnd?: () => void,
  _parent?: PaginatedStorage<any>
): AnyAsyncState => {
  const {
    isExpectedError,
    isLoaded,
    reloadIfStale,
    reloadOnFocus,
    loadingTimeout,
  } = options;

  const errorCallbacks: ValueChangeCallbacks = new Set();

  const errorState = {
    _onValueChange: createSubscribe(errorCallbacks),
    get: isExpectedError ? getError : get,
    set: setError,
    _isExpectedError: isExpectedError,
    _parent: undefined!,
    _value: undefined,
    _callbacks: errorCallbacks,
  } as Partial<ErrorState<any>> as ErrorState<any>;

  const stateCallbacks: ValueChangeCallbacks = new Set();

  const state = handleState<LoadableState<any, any, any>>(
    {
      _root: undefined!,
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
            _callbacks: new Set(),
          }
        : null,
      _keys,
      _tickEnd: _tickEnd || noop,
      _tickStart: _tickStart || noop,
      _parent,
      get,
      _callbacks: stateCallbacks,
      _children: undefined,
      set,
      _commonSet,
      _onValueChange: createSubscribe(stateCallbacks),
      load: _load! && load,
      _load,
      error: errorState,
      isLoaded: createSimpleState(false),
      control: undefined!,
      _subscribeWithError: alwaysNoop,
      _subscribeWithLoad: _load && alwaysNoop,
      _valueToggler: 0,
    },
    options.value,
    stateInitializer,
    _keys
  );

  if (_load) {
    state._subscribeWithLoad = createLoadableSubscribe(stateCallbacks, state);
  }

  state._subscribeWithError = createSubscribeWithError(
    stateCallbacks,
    errorCallbacks,
    state
  );

  const value = state._value;

  (state as Mutable<typeof state>)._root = state;

  (errorState as Mutable<typeof errorState>)._parent = state;

  if (value !== undefined) {
    const _isLoaded = isLoaded ? isLoaded(value, undefined, 0) : true;

    state.isLoaded._value = _isLoaded;

    if (_isLoaded && !options.revalidate) {
      state._isLoadable = false;
    }
  }

  if (Control) {
    (state as Mutable<typeof state>).control = new Control(options, state);
  }

  return state;
};

export default getAsyncState;
