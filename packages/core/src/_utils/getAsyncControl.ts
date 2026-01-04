import noop from 'lodash.noop';
import type {
  ValueChangeCallbacks,
  Mutable,
  InternalAsyncControl,
} from '#_types';
import alwaysTrue from '#shared/alwaysTrue';
import { addToBatch } from '#shared/batching';
import handleControl from '#utils/handleControl';
import { get } from '#utils/control/common';
import createSimpleControl from '#shared/createSimpleControl';
import createSubscribe from '#utils/createSubscribe';
import alwaysNoop from '#shared/alwaysNoop';
import {
  createLoadableSubscribe,
  createSubscribeWithError,
} from '#utils/createAsyncSubscribe';
import { ROOT } from '#shared/constants';
import { handleSlowLoading, handleUnload } from '#utils/asyncControlUtils';
import load from '#@/load';
import type { LoadableControlOptions, SyncExternalStorage } from '#types';

const handleReloadOn = (
  reloadData: NonNullable<InternalAsyncControl['_reloadIfStale']>,
  utils: { _isLoadable: boolean }
) => {
  clearTimeout(reloadData._timeoutId);

  reloadData._timeoutId = setTimeout(() => {
    utils._isLoadable = true;
  }, reloadData._timeout);
};

function set(
  this: InternalAsyncControl,
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

  self._isLoadedControl[ROOT]._set(isLoaded);

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
    self._errorControl[ROOT]._set(undefined);

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
  this: InternalAsyncControl['_errorControl'][typeof ROOT],
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

const getAsyncControl = (
  _commonSet: InternalAsyncControl['_commonSet'],
  options: Omit<LoadableControlOptions, 'load'>,
  _load: LoadableControlOptions<any, any, any, any[]>['load'] | undefined,
  _keys?: any[],
  syncExternalStorage?: SyncExternalStorage,
  LoadingProcess?: LoadableControlOptions<any, any, any>['LoadingProcess'],
  _tickStart?: () => void,
  _tickEnd?: () => void
): InternalAsyncControl => {
  const { isLoaded, reloadIfStale, reloadOnFocus, loadingTimeout } = options;

  const errorCallbacks: ValueChangeCallbacks = new Set();

  const controlCallbacks: ValueChangeCallbacks = new Set();

  const control = handleControl<InternalAsyncControl>(
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
      _get: get,
      _callbacks: controlCallbacks,
      _children: undefined,
      _set: set,
      _commonSet,
      _subscribe: createSubscribe(controlCallbacks),
      _load,
      _errorControl: undefined!,
      _isLoadedControl: createSimpleControl(false),
      _loadingProcess: undefined!,
      _subscribeWithError: alwaysNoop,
      _subscribeWithLoad: _load && alwaysNoop,
      _valueToggler: 0,
      _unobserve: undefined,
    },
    options.value,
    syncExternalStorage,
    _keys
  );

  if (_load) {
    control._subscribeWithLoad = createLoadableSubscribe(
      controlCallbacks,
      control
    );
  }

  control._subscribeWithError = createSubscribeWithError(
    controlCallbacks,
    errorCallbacks,
    control
  );

  const value = control._value;

  (control as Mutable<typeof control>)[ROOT] = control;

  (control as Mutable<typeof control>)._errorControl = {
    [ROOT]: {
      _subscribe: createSubscribe(errorCallbacks),
      _get: get,
      _set: setError,
      _parent: control,
      _value: undefined,
      _callbacks: errorCallbacks,
      _valueToggler: 0,
    },
  } as InternalAsyncControl['_errorControl'];

  if (value !== undefined) {
    const _isLoaded = isLoaded ? isLoaded(value, undefined, 0) : true;

    control._isLoadedControl[ROOT]._value = _isLoaded;

    if (_isLoaded && !options.revalidate) {
      control._isLoadable = false;
    }
  }

  if (LoadingProcess) {
    (control as Mutable<typeof control>)._loadingProcess = new LoadingProcess(
      options,
      control as any
    );
  }

  return control;
};

export default getAsyncControl;
