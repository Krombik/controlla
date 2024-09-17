import noop from 'lodash.noop';
import type {
  AnyAsyncState,
  AsyncState,
  ControllableState,
  ControllableStateOptions,
  InternalDataMap,
  Key,
  State,
} from '../types';
import { EMPTY_ARR, RootKey } from './constants';
import executeSetters from './executeSetters';
import createState from '../createState';
import deleteValue from './deleteValue';
import alwaysTrue from './alwaysTrue';

type Mutable<T extends {}> = {
  -readonly [key in keyof T]: T[key];
};

type _State = Mutable<AsyncState<any>> &
  Partial<Omit<ControllableState, keyof AsyncState<any>>>;

type _InternalUtils = _State['_internal'];

const handlePromise = (
  data: InternalDataMap,
  key: RootKey.PROMISE_REJECT | RootKey.PROMISE_RESOLVE,
  value: any
) => {
  if (data.has(key as RootKey.PROMISE_REJECT)) {
    data.get(key as RootKey.PROMISE_REJECT)!(value);

    data.delete(RootKey.PROMISE);

    data.delete(RootKey.PROMISE_RESOLVE);

    data.delete(RootKey.PROMISE_REJECT);
  }
};

const handleUnload = (data: InternalDataMap) => {
  if (data.has(RootKey.UNLOAD)) {
    data.get(RootKey.UNLOAD)!();

    data.delete(RootKey.UNLOAD);
  }
};

function _set(
  this: _InternalUtils,
  value: any,
  isSet: boolean,
  path: Key[],
  isError: boolean
) {
  const data = this._data;

  const rootValue = data.get(RootKey.VALUE);

  this._isFetchInProgress = false;

  const isLoaded = isSet ? this._isLoaded(value, rootValue) : isError;

  this._commonSet(value, isSet, path, isError);

  if (isSet) {
    handlePromise(data, RootKey.PROMISE_RESOLVE, rootValue);

    deleteValue(this._errorUtils, false);
  }

  this._isLoadedUtils._set(isLoaded, true, path, false);

  this._handleSlowLoading();

  if (isLoaded) {
    this._isLoadable = false;

    handleUnload(data);
  }
}

function _handleSlowLoading(this: _InternalUtils) {
  const data = this._data;

  clearTimeout(data.get(RootKey.SLOW_LOADING_TIMEOUT_ID));

  if (this._isLoadedUtils._data.get(RootKey.VALUE)) {
    data.delete(RootKey.SLOW_LOADING_TIMEOUT_ID);
  } else {
    data.set(
      RootKey.SLOW_LOADING_TIMEOUT_ID,
      setTimeout(() => {
        executeSetters(this._slowLoadingCallbackSet!);
      }, this._slowLoadingTimeout)
    );
  }
}

function _setError(
  this: _InternalUtils['_errorUtils'],
  value: any,
  isSet: boolean,
  path: Key[],
  isError: boolean
) {
  this._commonSet(value, isSet, path, isError);

  if (isSet) {
    deleteValue(this._parentUtils, true);

    handlePromise(this._data, RootKey.PROMISE_REJECT, value);
  }
}

function load(this: _State, reload?: boolean) {
  let isNotCanceled = true;

  const utils = this._internal;

  if (reload && !utils._isFetchInProgress) {
    handleUnload(utils._data);

    utils._isLoadable = true;
  }

  if (utils._isLoadable) {
    utils._isLoadable = false;

    utils._isLoadedUtils._set(false, true, EMPTY_ARR, false);

    utils._handleSlowLoading();

    const unload = utils._load!.apply(
      { ...this, _path: EMPTY_ARR },
      (this.keys as any) || EMPTY_ARR
    );

    if (unload) {
      utils._data.set(RootKey.UNLOAD, unload);
    }
  }

  utils._counter++;

  return () => {
    if (isNotCanceled) {
      isNotCanceled = false;

      if (!--utils._counter) {
        handleUnload(utils._data);

        if (!utils._isLoadedUtils._data.get(RootKey.VALUE)) {
          utils._isLoadable = true;
        }
      }
    }
  };
}

const getAsyncStateCreator =
  (createCommonState: (defaultValue?: any) => State<any>) =>
  ({
    value,
    isLoaded,
    load: _load,
    pause,
    resume,
    loadingTimeout,
    reset,
  }: Partial<ControllableStateOptions<any>>): AnyAsyncState<any> => {
    const errorState = createState() as _State['error'];

    const isLoadedState = createState(false);

    const state = {
      ...createCommonState(value),
      error: errorState,
      isLoaded: isLoadedState,
    } as _State;

    const utils: typeof state._internal = {
      ...state._internal,
      _commonSet: state._internal._set,
      _set,
      _isLoaded: isLoaded || alwaysTrue,
      _handleSlowLoading: noop,
      _counter: 0,
      _isFetchInProgress: false,
      _isLoadable: true,
      _load,
      _slowLoadingCallbackSet: undefined,
      _slowLoadingTimeout: undefined,
      _isLoadedUtils: isLoadedState._internal,
      _errorUtils: undefined!,
    };

    state._internal = utils;

    utils._errorUtils = errorState._internal = {
      ...errorState._internal,
      _commonSet: errorState._internal._set,
      _set: _setError,
      _parentUtils: utils,
    };

    if (_load) {
      if (loadingTimeout) {
        utils._slowLoadingCallbackSet = new Set();

        utils._slowLoadingTimeout = loadingTimeout;

        utils._handleSlowLoading = _handleSlowLoading;
      }

      return pause && resume && reset
        ? { ...state, load, pause, resume, reset }
        : {
            ...state,
            load,
          };
    }

    return state;
  };

export default getAsyncStateCreator;
