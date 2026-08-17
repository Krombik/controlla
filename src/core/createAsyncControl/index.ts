import noop from '#internal/noop';
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
  commitRootPatch,
  commitRootValue,
  UNCHANGED,
} from '#internal/commitPatchNode';
import {
  attachAsync,
  checkLoading,
  cleanupLoad,
  detachAsync,
  errorAttachAsync,
  errorDetachAsync,
  triggerLoad,
} from './utils.ts';
import addToLevel from '#internal/addToLevel';
import { attach, detach } from '#internal/syncLifecycle';
import makeStatusInternals from '#internal/makeStatusInternals';
import settlePromise from '#internal/settlePromise';
import armPromise from '#internal/armPromise';
import { commitErrorValue, commitStatusValue } from '#internal/commitStatus';
import { notify } from '#internal/flushQueue';
import { sourceUpdate } from '#internal/sourceUpdate';

const throwIfUndefined = () => {
  throw new Error('cannot be set to undefined, use invalidate to reload');
};

function asyncEnqueueSet(
  this: AsyncControlInternals,
  value: any,
  lane: Lane,
  fromSource: boolean,
  path: string[] | undefined
) {
  if (path === undefined && value === undefined) {
    throwIfUndefined();
  }

  queuePatch(lane, this, value, path)._fromSource = fromSource;
}

function errorEnqueueSet(
  this: ErrorControlInternals<AsyncControlInternals>,
  value: any,
  lane: Lane,
  fromSource: boolean
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

  // the kept value is indistinguishable from a settled one once the reload is
  // under way, so the promise is armed here rather than at the commit: a
  // `toPromise` right after this must not read that value as settled, and the
  // patch may well be committed by a flush already running
  if (type == PatchType.SILENT_RELOAD && !internals._promise) {
    // nobody has to be awaiting it yet, and a failed reload rejects it
    armPromise(internals).catch(noop);
  }

  if (patchNode) {
    patchNode._type = type;

    patchNode._value = value;

    patchNode._fromSource = fromSource;

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
      _fromSource: fromSource,
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

  sourceUpdate._value = patchNode._fromSource;

  if (patchType < PatchType.ERROR) {
    nextValue = commitRootPatch(internals, patchNode, prevValue, lane);

    const value = nextValue !== UNCHANGED ? nextValue : prevValue;

    if (value !== undefined) {
      nextLoadingValue = checkLoading(internals, value, prevValue);

      nextReadyValue = true;

      internals._attempt = nextLoadingValue ? internals._attempt + 1 : 0;

      // the value is already in place, and whoever awaited it is a microtask
      // behind either way
      settlePromise(internals, true, value);
    }
  } else if (patchType == PatchType.ERROR) {
    nextValue = commitRootValue(internals, undefined, prevValue, lane);

    nextErrorValue = patchNode._value;

    nextLoadingValue = false;

    nextReadyValue = undefined;

    internals._attempt = 0;
  } else if (patchType == PatchType.RELOAD) {
    nextValue = commitRootValue(internals, undefined, prevValue, lane);

    nextLoadingValue = true;

    nextReadyValue = undefined;
  } else {
    nextValue = UNCHANGED;

    nextLoadingValue = true;
  }

  if (nextValue !== UNCHANGED) {
    notify(internals, lane, nextValue, prevValue);

    internals._setExternal(nextValue);
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

    notify(loadingControl, lane, nextLoadingValue, prevLoading);

    if (load) {
      // still in use, or the deferred unload cleanup hasn't flushed yet
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

  sourceUpdate._value = false;
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
    externalStorage?: SyncExternalStorage<T | undefined>
  ): AsyncControlScope<T, E>;
} = (
  options?: AsyncControlOptions,
  externalStorage?: SyncExternalStorage,
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
              _dependents: EMPTY_ARR,
            }
          : null,
      },
      _isLoaded: isLoaded || alwaysTrue,
      _attempt: 0,
      _promise: undefined,
    },
    options && options.initialValue,
    externalStorage,
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
      !checkLoading(internals, value, undefined)
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
