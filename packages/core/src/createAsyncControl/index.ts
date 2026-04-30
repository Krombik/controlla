import type {
  AsyncControlScope,
  AsyncControlOptions,
  SyncExternalStorage,
} from '#types';
import createScope from '#internal/createScope';
import type {
  Mutable,
  AsyncControlInternals,
  ErrorControlInternals,
  PatchTreeNode,
  Lane,
} from '#internal/types';
import alwaysTrue from '#shared-internal/alwaysTrue';
import initControl from '#internal/initControl';
import readRootValue from '#internal/readRootValue';
import { INTERNALS } from '#shared-internal/constants';
import runPatching from '#internal/runPatching';
import { commitPatchNode, UNCHANGED } from '#internal/commitPatchNode';
import { EMPTY_ARR, RELOAD, SILENT_RELOAD } from '#internal/constants';
import {
  attachAsync,
  detachAsync,
  errorAttachAsync,
  errorDetachAsync,
  handleLoadingStateControls,
} from '#internal/asyncLifecycle';
import notify from '#internal/notify';
import addToLevel from '#internal/addToLevel';
import { attach, detach } from '#internal/syncLifecycle';

function asyncEnqueueSet(
  this: AsyncControlInternals,
  value: any,
  lane: Lane,
  path: string[] | undefined
) {
  runPatching(lane, this, value, path);

  if (!path && value !== undefined) {
    const errControl = this._errorControl[INTERNALS];

    const { _patchByControl } = lane;

    if (!_patchByControl.has(errControl)) {
      addToLevel(lane, errControl);
    }

    _patchByControl.set(errControl, undefined);
  }
}

function errorEnqueueSet(
  this: ErrorControlInternals<AsyncControlInternals>,
  value: any,
  lane: Lane
) {
  const internals = this;

  const { _patchByControl } = lane;

  if (value !== undefined) {
    runPatching(lane, internals._parent, undefined, undefined);
  }

  if (!_patchByControl.has(internals)) {
    addToLevel(lane, internals);
  }

  _patchByControl.set(internals, value);
}

function commitAsyncSet(
  this: AsyncControlInternals,
  patchNode: PatchTreeNode,
  lane: Lane
) {
  const internals = this;

  const prevValue = internals._value;

  const nextValue = commitPatchNode(patchNode, prevValue, internals, lane);

  if (nextValue !== UNCHANGED) {
    internals._value = nextValue;

    notify(
      internals._listeners,
      internals._dependents,
      lane,
      nextValue,
      prevValue
    );

    if (internals._externalStorage) {
      internals._externalStorage.set(nextValue);
    }

    if (nextValue !== undefined) {
      const isLoaded = internals._isLoaded(
        nextValue,
        prevValue,
        internals._attempt
      );

      internals._attempt = isLoaded ? 0 : internals._attempt + 1;

      handleLoadingStateControls(internals, lane, isLoaded, true);

      if (internals._promise) {
        internals._promise._resolve(nextValue);

        internals._promise = undefined;
      }
    }
  }
}

function commitErrorSet(
  this: ErrorControlInternals<AsyncControlInternals>,
  nextValue: any,
  lane: Lane
) {
  const internals = this;

  const prevValue = internals._value;

  if (nextValue !== RELOAD && nextValue !== SILENT_RELOAD) {
    if (prevValue !== nextValue) {
      const parent = internals._parent;

      internals._value = nextValue;

      notify(
        internals._listeners,
        internals._dependents,
        lane,
        nextValue,
        prevValue
      );

      if (prevValue === undefined) {
        parent._attempt = 0;

        handleLoadingStateControls(parent, lane, true, undefined);

        if (parent._promise) {
          parent._promise._reject(nextValue);

          parent._promise = undefined;
        }
      }
    }
  } else {
    const wasError = prevValue !== undefined;

    if (wasError) {
      internals._value = undefined;

      notify(
        internals._listeners,
        internals._dependents,
        lane,
        undefined,
        prevValue
      );
    }

    handleLoadingStateControls(
      internals._parent,
      lane,
      false,
      wasError || nextValue === RELOAD ? undefined : true
    );
  }
}

const createAsyncControl: {
  <T, E = any>(
    options?: AsyncControlOptions<T, never, E>,
    syncExternalStorage?: SyncExternalStorage<T | undefined>
  ): AsyncControlScope<T, E>;
} = (
  options?: AsyncControlOptions,
  syncExternalStorage?: SyncExternalStorage,
  keys?: any[]
) => {
  const isLoaded = options && options.isLoaded;

  const source = options && options.source;

  const loadingControl: AsyncControlInternals['_loadingControl'][typeof INTERNALS] =
    {
      [INTERNALS]: undefined!,
      _get: readRootValue,
      _listeners: EMPTY_ARR,
      _indexMap: undefined,
      _dependents: EMPTY_ARR,
      _path: undefined,
      _value: true,
      _level: 0,
      _load: undefined,
    };

  const readyControl: AsyncControlInternals['_readyControl'][typeof INTERNALS] =
    {
      [INTERNALS]: undefined!,
      _get: readRootValue,
      _listeners: EMPTY_ARR,
      _indexMap: undefined,
      _dependents: EMPTY_ARR,
      _path: undefined,
      _value: undefined,
      _level: 0,
      _load: undefined,
    };

  const errorControl: ErrorControlInternals<AsyncControlInternals> = {
    [INTERNALS]: undefined!,
    _get: readRootValue,
    _listeners: EMPTY_ARR,
    _indexMap: undefined,
    _dependents: EMPTY_ARR,
    _path: undefined,
    _value: undefined,
    _level: 0,
    _attach: source ? errorAttachAsync : attach,
    _detach: source ? errorDetachAsync : detach,
    _commitSet: commitErrorSet,
    _enqueueSet: errorEnqueueSet,
    _parent: undefined!,
    _load: source ? true : undefined,
  };

  const internals = initControl<AsyncControlInternals>(
    {
      [INTERNALS]: undefined!,
      _get: readRootValue,
      _listeners: EMPTY_ARR,
      _indexMap: undefined,
      _dependents: EMPTY_ARR,
      _path: undefined,
      _value: undefined,
      _level: 0,
      _children: undefined,
      _storage: undefined,
      _commitSet: commitAsyncSet,
      _enqueueSet: asyncEnqueueSet,
      _attach: source ? attachAsync : attach,
      _detach: source ? detachAsync : detach,
      _externalStorage: undefined,
      _errorControl: { [INTERNALS]: errorControl },
      _loadingControl: { [INTERNALS]: loadingControl },
      _readyControl: { [INTERNALS]: readyControl },
      _load: source && {
        _activeCount: 0,
        _canScheduleUnload: true,
        _source: source,
        _cleanup: undefined,
        _loadedAt: 0,
        _keys: keys,
        _slowLoadMonitor: source.loadingTimeout
          ? {
              _timerId: undefined,
              _listeners: EMPTY_ARR,
              _indexMap: undefined,
            }
          : null,
      },
      _isLoaded: isLoaded || alwaysTrue,
      _attempt: 0,
      _promise: undefined,
    },
    options && options.value,
    syncExternalStorage,
    keys
  );

  const value = internals._value;

  (errorControl as Mutable<typeof errorControl>)[INTERNALS] = errorControl;

  (errorControl as Mutable<typeof errorControl>)._parent = internals;

  (readyControl as Mutable<typeof readyControl>)[INTERNALS] = internals;

  (loadingControl as Mutable<typeof loadingControl>)[INTERNALS] = internals;

  if (value !== undefined) {
    readyControl._value = true;

    if (
      (!source || !source.revalidate) &&
      (!isLoaded || isLoaded(value, undefined, 0))
    ) {
      loadingControl._value = false;

      if (source) {
        internals._load!._loadedAt =
          source.reloadIfStale || source.reloadOnFocus ? Date.now() : 1;
      }
    }
  }

  return createScope(internals);
};

export default createAsyncControl;
