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
import {
  commitNextValue,
  commitPatchNode,
  UNCHANGED,
} from '#internal/commitPatchNode';
import {
  EMPTY_ARR,
  PatchType,
  RELOAD,
  SILENT_RELOAD,
} from '#internal/constants';
import {
  attachAsync,
  cleanupLoad,
  detachAsync,
  errorAttachAsync,
  errorDetachAsync,
  triggerLoad,
} from './utils';
import notify from '#internal/notify';
import addToLevel from '#internal/addToLevel';
import { attach, detach } from '#internal/syncLifecycle';
import makeStatusInternals from '#internal/makeStatusInternals';
import settlePromise from '#internal/settlePromise';

const throwIfUndefined = () => {
  throw new Error(
    '[control] Cannot set undefined directly. Use invalidate(control) to trigger a reload'
  );
};

function asyncEnqueueSet(
  this: AsyncControlInternals,
  value: any,
  lane: Lane,
  path: string[] | undefined
) {
  if (path === undefined && value === undefined) {
    throwIfUndefined();
  }

  runPatching(lane, this, value, path);
}

function errorEnqueueSet(
  this: ErrorControlInternals<AsyncControlInternals>,
  value: any,
  lane: Lane,
  _: any
) {
  if (value === undefined) {
    throwIfUndefined();
  }

  const internals = this._parent;

  const { _patchByControl } = lane;

  const patchNode = _patchByControl.get(internals);

  const type =
    value === RELOAD
      ? PatchType.RELOAD
      : value === SILENT_RELOAD
        ? PatchType.SILENT_RELOAD
        : PatchType.ERROR;

  if (patchNode) {
    patchNode._type = type;

    patchNode._value = value;

    if (patchNode._patchedKeys.length) {
      patchNode._patchedKeys.length = 0;

      patchNode._children.clear();
    }
  } else {
    addToLevel(lane, internals);

    _patchByControl.set(internals, {
      _children: new Map(),
      _type: type,
      _patchedKeys: [],
      _value: value,
    });
  }
}

function commitAsyncSet(
  this: AsyncControlInternals,
  patchNode: PatchTreeNode,
  lane: Lane
) {
  const internals = this;

  const errorInternals = internals._errorControl[INTERNALS];

  const loadingControl = internals._loadingControl[INTERNALS];

  const readyControl = internals._readyControl[INTERNALS];

  const prevLoading: boolean = loadingControl._value;

  const prevReady: true | undefined = readyControl._value;

  const prevValue = internals._value;

  const prevErrorValue = errorInternals._value;

  const patchType = patchNode._type;

  const load = internals._load;

  let nextValue;

  let nextErrorValue: any;

  let nextReadyValue = prevReady;

  let nextLoadingValue = prevLoading;

  if (patchType < PatchType.ERROR) {
    nextValue = commitPatchNode(patchNode, prevValue, internals, lane);
  } else if (patchType == PatchType.ERROR) {
    nextValue = commitNextValue(undefined, prevValue, internals, lane);

    nextErrorValue = patchNode._value;
  } else if (PatchType.RELOAD) {
    nextValue = commitNextValue(undefined, prevValue, internals, lane);

    nextLoadingValue = true;

    nextReadyValue = undefined;
  } else {
    nextValue = UNCHANGED;

    nextLoadingValue = true;
  }

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
      nextLoadingValue = !internals._isLoaded(
        nextValue,
        prevValue,
        internals._attempt
      );

      nextReadyValue = true;

      internals._attempt = nextLoadingValue ? internals._attempt + 1 : 0;

      settlePromise(internals, true, nextValue);
    }
  }

  if (nextErrorValue !== prevErrorValue) {
    internals._value = nextErrorValue;

    notify(
      internals._listeners,
      internals._dependents,
      lane,
      nextErrorValue,
      prevErrorValue
    );

    if (nextErrorValue !== undefined) {
      nextLoadingValue = false;

      nextReadyValue = undefined;

      internals._attempt = 0;

      settlePromise(internals, false, nextErrorValue);
    }
  }

  if (!nextLoadingValue && load) {
    load._loadedAt =
      load._source.reloadOnFocus || load._source.reloadIfStale ? Date.now() : 1;
  }

  if (nextLoadingValue != prevLoading) {
    loadingControl._value = nextLoadingValue;

    notify(
      loadingControl._listeners,
      loadingControl._dependents,
      lane,
      nextLoadingValue,
      prevLoading
    );

    if (load) {
      if (load._activeCount || !load._canScheduleUnload) {
        if (nextLoadingValue) {
          triggerLoad(internals);
        } else {
          cleanupLoad(load);
        }
      } else if (nextLoadingValue) {
        load._loadedAt = 0;
      }
    }
  }

  if (prevReady !== nextReadyValue) {
    readyControl._value = nextReadyValue;

    notify(
      readyControl._listeners,
      readyControl._dependents,
      lane,
      nextReadyValue,
      prevReady
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

  const isLoadable = !!source;

  const loadingInternals = makeStatusInternals(undefined!, true);

  const readyInternals = makeStatusInternals(undefined!, undefined);

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
    _enqueueSet: errorEnqueueSet,
    _parent: undefined!,
    _load: isLoadable,
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
      _loadingControl: { [INTERNALS]: loadingInternals },
      _readyControl: { [INTERNALS]: readyInternals },
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

  (readyInternals as Mutable<typeof readyInternals>)[INTERNALS] = internals;

  (loadingInternals as Mutable<typeof loadingInternals>)[INTERNALS] = internals;

  if (value !== undefined) {
    readyInternals._value = true;

    if (
      (!isLoadable || !source.revalidate) &&
      (!isLoaded || isLoaded(value, undefined, 0))
    ) {
      loadingInternals._value = false;

      if (isLoadable) {
        internals._load!._loadedAt =
          source.reloadIfStale || source.reloadOnFocus ? Date.now() : 1;
      }
    }
  }

  return createScope(internals);
};

export default createAsyncControl;
