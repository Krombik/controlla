import noop from 'lodash.noop';
import type {
  ValueChangeCallbacks,
  LoadableStateOptions,
  Mutable,
  PaginatedStorage,
  StateInitializer,
  InternalAsyncState,
} from '../types';
import alwaysTrue from './alwaysTrue';
import { addToBatch } from './batching';
import handleState from './handleState';
import { get } from './state/common';
import createSimpleState from './createSimpleState';
import createSubscribe from './createSubscribe';
import alwaysNoop from './alwaysNoop';
import {
  createLoadableSubscribe,
  createSubscribeWithError,
} from './createAsyncSubscribe';
import { ROOT } from './constants';
import { handleSlowLoading, handleUnload } from './asyncStateUtils';
import load from '../load';

const handleReloadOn = (
  reloadData: NonNullable<InternalAsyncState['_reloadIfStale']>,
  utils: { _isLoadable: boolean }
) => {
  clearTimeout(reloadData._timeoutId);

  reloadData._timeoutId = setTimeout(() => {
    utils._isLoadable = true;
  }, reloadData._timeout);
};

function set(
  this: InternalAsyncState,
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

  self._isLoadedState[ROOT]._set(isLoaded);

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
    self._errorState[ROOT]._set(undefined);

    if (!isSet) {
      if (self._counter) {
        load(self, true)();
      } else {
        self._isLoadable = true;
      }
    } else if (self._promise) {
      self._promise._resolve(newRootValue);

      self._promise = null;
    }
  }

  handleSlowLoading(self._slowLoading, isLoaded);
}

function setError(
  this: InternalAsyncState['_errorState'][typeof ROOT],
  value: any
) {
  const self = this;

  if (self._value !== value) {
    self._value = value;

    addToBatch(self, value);

    if (value !== undefined) {
      const parent = self._parent;

      parent._set(undefined, undefined, true);

      if (parent._promise) {
        parent._promise._reject(value);

        parent._promise = null;
      }
    }
  }
}

const getAsyncState = (
  _commonSet: InternalAsyncState['_commonSet'],
  options: Omit<LoadableStateOptions, 'load'>,
  stateInitializer: StateInitializer | undefined,
  _keys: any[] | undefined,
  _load?: LoadableStateOptions<any, any, any, any[]>['load'],
  Control?: LoadableStateOptions<any, any, any>['Control'],
  _tickStart?: () => void,
  _tickEnd?: () => void,
  _parent?: PaginatedStorage<any>
): InternalAsyncState => {
  const { isLoaded, reloadIfStale, reloadOnFocus, loadingTimeout } = options;

  const errorCallbacks: ValueChangeCallbacks = new Set();

  const stateCallbacks: ValueChangeCallbacks = new Set();

  const state = handleState<InternalAsyncState>(
    {
      [ROOT]: undefined!,
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
      _get: get,
      _callbacks: stateCallbacks,
      _children: undefined,
      _set: set,
      _commonSet,
      _onValueChange: createSubscribe(stateCallbacks),
      _load,
      _errorState: undefined!,
      _isLoadedState: createSimpleState(false),
      _loadingProcess: undefined!,
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

  (state as Mutable<typeof state>)[ROOT] = state;

  (state as Mutable<typeof state>)._errorState = {
    [ROOT]: {
      _onValueChange: createSubscribe(errorCallbacks),
      _get: get,
      _set: setError,
      _parent: state,
      _value: undefined,
      _callbacks: errorCallbacks,
      _valueToggler: 0,
    },
  } as InternalAsyncState['_errorState'];

  if (value !== undefined) {
    const _isLoaded = isLoaded ? isLoaded(value, undefined, 0) : true;

    state._isLoadedState[ROOT]._value = _isLoaded;

    if (_isLoaded && !options.revalidate) {
      state._isLoadable = false;
    }
  }

  if (Control) {
    (state as Mutable<typeof state>)._loadingProcess = new Control(
      options,
      state as any
    );
  }

  return state;
};

export default getAsyncState;
