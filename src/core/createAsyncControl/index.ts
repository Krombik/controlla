import noop from 'lodash.noop';
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
import alwaysTrue from '#internal/alwaysTrue';
import initControl from '#internal/initControl';
import readRootValue from '#internal/readRootValue';
import {
  INTERNALS,
  EMPTY_ARR,
  PatchType,
  RELOAD,
  SILENT_RELOAD,
} from '#internal/constants';
import queuePatch from '#internal/queuePatch';
import {
  commitNextValue,
  commitPatchNode,
  UNCHANGED,
} from '#internal/commitPatchNode';
import {
  attachAsync,
  cleanupLoad,
  detachAsync,
  errorAttachAsync,
  errorDetachAsync,
  triggerLoad,
} from './utils';
import addToLevel from '#internal/addToLevel';
import { attach, detach } from '#internal/syncLifecycle';
import makeStatusInternals from '#internal/makeStatusInternals';
import settlePromise from '#internal/settlePromise';
import { commitErrorValue, commitStatusValue } from '#internal/commitStatus';
import { notify } from '#internal/flushQueue';

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

  queuePatch(lane, this, value, path);
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
  } else if (patchType == PatchType.RELOAD) {
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

    internals._setExternal(nextValue);

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

  if (nextErrorValue !== undefined) {
    nextLoadingValue = false;

    nextReadyValue = undefined;

    internals._attempt = 0;
  }

  commitErrorValue(internals, errorInternals, nextErrorValue, lane);

  if (!nextLoadingValue && load) {
    load._loadedAt =
      load._options.reloadOnFocus || load._options.reloadIfStale
        ? Date.now()
        : 1;
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

  commitStatusValue(readyControl, nextReadyValue, lane);
}

const createAsyncControl: {
  /**
   * Creates an {@link AsyncControlScope async control} for a value that
   * arrives asynchronously, with loading / ready / error status (ready = has a
   * value) — read via `selectLoading`/`selectReady`/`selectError`.
   *
   * Pass {@link AsyncControlOptions.load load} (usually from a loader like
   * `requestLoader`/`pollLoader`) to make it loadable: loading starts on first
   * use (value hooks, Consumer components, the `load` method — not plain
   * listeners). Without `load`, push the value with `setValue`.
   *
   * Can't be set to `undefined` — call `invalidate` to reset and reload.
   *
   * @example
   * ```ts
   * // loadable — fetches on first use
   * const $products = createAsyncControl(
   *   requestLoader(() => fetch('/api/products').then((r) => r.json()))
   * );
   *
   * // manual — value is pushed from outside
   * const $position = createAsyncControl<GeolocationPosition>();
   * navigator.geolocation.watchPosition((pos) => setValue($position, pos));
   * ```
   */
  <T, E = any>(
    options?: AsyncControlOptions<T, E>,
    syncExternalStorage?: SyncExternalStorage<T | undefined>
  ): AsyncControlScope<T, E>;
} = (
  options?: AsyncControlOptions,
  syncExternalStorage?: SyncExternalStorage,
  keys?: any[]
) => {
  const isLoaded = options && options.isLoaded;

  const isLoadable = options && options.load && true;

  const loadingInternals = makeStatusInternals(undefined!, true);

  const readyInternals = makeStatusInternals(undefined!, undefined);

  const errorControl: ErrorControlInternals<AsyncControlInternals> = {
    _root: undefined!,
    _get: readRootValue,
    _listeners: EMPTY_ARR,
    _indexMap: undefined,
    _dependents: EMPTY_ARR,
    _path: undefined,
    _value: undefined,
    _level: 0,
    _attach: isLoadable ? errorAttachAsync : attach,
    _detach: isLoadable ? errorDetachAsync : detach,
    _enqueueSet: errorEnqueueSet,
    _parent: undefined!,
    _load: isLoadable,
  };

  const internals = initControl<AsyncControlInternals>(
    {
      _root: undefined!,
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
      _attach: isLoadable ? attachAsync : attach,
      _detach: isLoadable ? detachAsync : detach,
      _setExternal: noop,
      _errorControl: { [INTERNALS]: errorControl },
      _loadingControl: { [INTERNALS]: loadingInternals },
      _readyControl: { [INTERNALS]: readyInternals },
      _load: isLoadable && {
        _activeCount: 0,
        _canScheduleUnload: true,
        _options: options,
        _cleanup: undefined,
        _loadedAt: 0,
        _keys: keys,
        _slowLoadMonitor: options.loadingTimeout
          ? {
              _timerId: undefined,
              _indexMap: undefined,
              _listeners: EMPTY_ARR,
            }
          : null,
      },
      _isLoaded: isLoaded || alwaysTrue,
      _attempt: 0,
      _promise: undefined,
    },
    options && options.initialValue,
    syncExternalStorage,
    keys,
    false
  );

  const value = internals._value;

  (errorControl as Mutable<typeof errorControl>)._root = errorControl;

  (errorControl as Mutable<typeof errorControl>)._parent = internals;

  (readyInternals as Mutable<typeof readyInternals>)._root = internals;

  (loadingInternals as Mutable<typeof loadingInternals>)._root = internals;

  if (value !== undefined) {
    readyInternals._value = true;

    if (
      (!isLoadable || !options.revalidate) &&
      (!isLoaded || isLoaded(value, undefined, 0))
    ) {
      loadingInternals._value = false;

      if (isLoadable) {
        internals._load!._loadedAt =
          options.reloadIfStale || options.reloadOnFocus ? Date.now() : 1;
      }
    }
  }

  return createScope(internals);
};

export default createAsyncControl;
