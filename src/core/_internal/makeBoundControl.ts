import type {
  Registry,
  AsyncControlScope,
  ControlScope,
  Control,
} from '#types';
import type {
  ErrorControlInternals,
  AsyncControlInternals,
  AsyncStatusControls,
  ChangeListener,
  ChildControlNode,
  ControlInternals,
  ControlInternalsChild,
  Lane,
  Mutable,
  Notifier,
  ControlInternalsBase,
  Subscription,
} from '#internal/types';
import noop from '#internal/noop';
import createScope from '#internal/createScope';
import readRootValue from '#internal/readRootValue';
import {
  INTERNALS,
  ControlType,
  EMPTY_ARR,
  RELOAD,
  SILENT_RELOAD,
} from '#internal/constants';
import append from '#internal/append';
import { addListener, notify, removeListener } from '#internal/flushQueue';
import addToQueue from '#internal/addToQueue';
import { commitRootValue, UNCHANGED } from '#internal/commitPatchNode';
import removeFromArray from '#internal/removeFromArray';
import attachNotifier from '#internal/attachNotifier';
import makeChildNode from '#internal/makeChildNode';
import getStorageKey from '#internal/getStorageKey';
import makeStatusInternals from '#internal/makeStatusInternals';
import settlePromise from '#internal/settlePromise';
import armPromise from '#internal/armPromise';
import { AggregateControlError } from '#internal/AggregateControlError';
import throwReadonlyError from '#internal/throwReadonlyError';
import { commitErrorValue, commitStatusValue } from '#internal/commitStatus';
import { sourceUpdate } from '#internal/sourceUpdate';
import {
  createItem,
  getControlType,
  getRegistryDepth,
} from '#internal/registryHelpers';
import { actualizePending, registerSubscription } from '#internal/cleanup';
import { silentLane } from '#internal/flushQueue';

type Undefinable<O extends {}> = {
  [key in keyof O]: O[key] | undefined;
};

interface BoundInternals
  extends
    Subscription,
    ControlInternals,
    Undefinable<AsyncStatusControls<BoundInternals>> {
  _activeCount: number;
  _holdingPrev: boolean;
  /** What the change was for the target - the commit here is a flush behind it. */
  _fromSource: boolean;
  _target: ControlInternals | AsyncControlInternals | undefined;
  readonly _activeNodes: BoundInternalsChild[];
  readonly _changedNodes: BoundInternalsChild[];
  readonly _selfNotifier: Notifier;
  _keys: any[];
  /** By key index, for the keys that are controls; the rest are holes. */
  readonly _sources: Array<ControlInternalsChild | undefined>;
  readonly _notifiers: Notifier[];
  readonly _load: ReadonlyArray<ControlInternals> | undefined;
  readonly _registry: Registry<any, any>;
  readonly _errors: any[] | undefined;
}

type BoundInternalsChild = ChildControlNode<BoundInternals>;

function enqueueBoundSet(
  this: BoundInternals,
  value: any,
  lane: Lane,
  fromSource: boolean,
  path: string[] | undefined
) {
  const target = this._target;

  if (target) {
    target._enqueueSet(value, lane, fromSource, path);
  } else if (process.env.NODE_ENV !== 'production') {
    console.warn(
      '[registry] setValue on bound control with unresolved keys was ignored. Wait for all key controls to be ready before writing.'
    );
  }
}

function enqueueBoundErrorSet(
  this: ErrorControlInternals<BoundInternals>,
  value: any,
  lane: Lane,
  fromSource: boolean,
  path: string[] | undefined
) {
  if (value !== RELOAD && value !== SILENT_RELOAD) {
    throwReadonlyError();
  }

  const parent = this._parent;

  const target = parent._target;

  if (target) {
    const targetInternals = target as AsyncControlInternals;

    targetInternals._errorControl[INTERNALS]._enqueueSet(
      value,
      lane,
      fromSource,
      path
    );

    const targetPromise = targetInternals._promise;

    if (targetPromise && !parent._promise) {
      // nobody has to be awaiting it yet, and a failed reload rejects it
      armPromise(parent).catch(noop);

      targetPromise._promise.then(
        (settled) => {
          settlePromise(parent, true, settled);
        },
        (error) => {
          settlePromise(parent, false, error);
        }
      );
    }
  } else if (process.env.NODE_ENV !== 'production') {
    console.warn(
      '[registry] invalidate on bound control with unresolved or non-async target was ignored.'
    );
  }
}

function childNodeNotify(this: Notifier, _: Lane, value: any, prevValue: any) {
  const node: BoundInternalsChild = this._target;

  const data = node._boundData!;

  data._value = value;

  data._prevValue = prevValue;

  node._root._changedNodes.push(node);
}

/**
 * (Re)decides the hold on each change while a target is attached or a hold is
 * ongoing; a stale false when targetless and not holding is harmless.
 */
const holdPrev = (root: BoundInternals, index: number) => {
  if (root._target || root._holdingPrev) {
    const keepPrev = root._registry._keepPrev;

    root._holdingPrev =
      keepPrev && (typeof keepPrev == 'boolean' ? keepPrev : keepPrev[index]);
  }
};

const cleanupPrevTarget = (root: BoundInternals) => {
  const prevTarget = root._target;

  if (prevTarget) {
    const activeNodes = root._activeNodes;

    const notifier = root._selfNotifier;

    root._target = undefined;

    if (root._registry._type != ControlType.SYNC) {
      const prevLoad = prevTarget._load as AsyncControlInternals['_load'];

      if (prevLoad && root._activeCount) {
        prevLoad._activeCount -= root._activeCount - 1;

        prevTarget._detach(undefined, undefined, true);
      }

      removeFromArray(
        (prevTarget as AsyncControlInternals)._errorControl[INTERNALS]
          ._dependents,
        notifier
      );
    }

    removeFromArray(prevTarget._dependents, notifier);

    for (let i = 0, l = activeNodes.length; i < l; i++) {
      const notifier = activeNodes[i]._boundData!._selfNotifier;

      removeFromArray(notifier._attachedTo!, notifier);

      notifier._attachedTo = EMPTY_ARR;

      notifier._source = undefined;
    }

    root._changedNodes.length = 0;
  }
};

/**
 * The commit below runs a level later, when whatever moved the target is long
 * done - so what that was is kept here, where it is still true. A key and the
 * target can both move into one commit, and either of them being the source
 * makes the value it lands on the source's; the commit clears it again.
 */
function targetChangeNotify(this: Notifier, lane: Lane) {
  const root: BoundInternals = this._target;

  root._fromSource ||= sourceUpdate._value;

  addToQueue(lane, root);
}

function keyChangeNotify(this: Notifier, lane: Lane, value: any) {
  const root: BoundInternals = this._target;

  root._fromSource ||= sourceUpdate._value;

  root._keys[this._index] = value;

  holdPrev(root, this._index);

  cleanupPrevTarget(root);

  addToQueue(lane, root);
}

function keyErrorChangeNotify(this: Notifier, lane: Lane, value: any) {
  const root: BoundInternals = this._target;

  root._fromSource ||= sourceUpdate._value;

  root._errors![this._index] = value;

  addToQueue(lane, root);
}

const getNextTarget = (registry: Registry<any, any>, keys: any[]) => {
  let storage = registry._storage;

  let nextStorage = storage;

  const endIndex = keys.length - 1;

  for (let i = 0; i < endIndex; i++) {
    const key = keys[i];

    if (key === undefined) {
      return;
    }

    const storageKey = getStorageKey(key);

    nextStorage = nextStorage && storage.get(storageKey);

    if (nextStorage) {
      storage = nextStorage;
    } else {
      storage.set(storageKey, (storage = new Map()));
    }
  }

  const key = keys[endIndex];

  if (key !== undefined) {
    const storageKey = getStorageKey(key);

    let control: ControlScope | Control | AsyncControlScope =
      nextStorage && storage.get(storageKey);

    return (
      control === undefined
        ? createItem(registry, storage, storageKey, keys)
        : control
    )[INTERNALS] as ControlInternals;
  }
};

function commitSet(this: BoundInternals, _: any, lane: Lane) {
  const root = this;

  sourceUpdate._value = root._fromSource;

  root._fromSource = false;

  const errors = root._errors;

  const prevValue = root._value;

  const registry = root._registry;

  let currentTarget = root._target;

  const isRetargeted = !currentTarget;

  // keepPrev/suppressError: hold the last value instead of showing undefined
  let heldPrev = false;

  if (currentTarget) {
    const changedNodes = root._changedNodes;

    const value = currentTarget._value;

    if (value !== prevValue) {
      if (
        value === undefined &&
        registry._type != ControlType.SYNC &&
        ((currentTarget as AsyncControlInternals)._errorControl[INTERNALS]
          ._value !== undefined
          ? registry._suppressError
          : root._holdingPrev)
      ) {
        // hold the last value while the target is not ready (on error only
        // with suppressError; a later reload continues an ongoing hold)
        heldPrev = true;

        changedNodes.length = 0;
      } else {
        // the target already holds it, so the bound nodes below can be told
        // straight away
        root._value = value;

        for (let i = 0, l = changedNodes.length; i < l; i++) {
          const node = changedNodes[i];

          const data = node._boundData!;

          const { _prevValue: prevValue, _value: nextValue } = data;

          data._prevValue = undefined;

          data._value = undefined;

          notify(node, lane, nextValue, prevValue);
        }

        changedNodes.length = 0;

        notify(root, lane, value, prevValue);

        if (value !== undefined) {
          settlePromise(root, true, value);
        }
      }
    }
  } else {
    const activeNodes = root._activeNodes;

    currentTarget = getNextTarget(registry, root._keys);

    if (currentTarget) {
      attachUntrackedNotifier(currentTarget, root._selfNotifier);

      for (let i = 0, l = activeNodes.length; i < l; i++) {
        const node = activeNodes[i];

        attachNotifierToTargetNode(
          currentTarget,
          node._path!,
          node._boundData!._selfNotifier
        );
      }

      root._target = currentTarget;
    }

    const newValue = currentTarget && currentTarget._value;

    if (
      errors &&
      root._holdingPrev &&
      newValue === undefined &&
      prevValue !== undefined
    ) {
      if (currentTarget) {
        heldPrev =
          registry._suppressError ||
          registry._type == ControlType.SYNC ||
          (currentTarget as AsyncControlInternals)._errorControl[INTERNALS]
            ._value === undefined;
      } else {
        heldPrev = true;

        if (!registry._suppressError) {
          for (let i = registry._depth; i--;) {
            if (errors[i] !== undefined) {
              heldPrev = false;

              break;
            }
          }
        }
      }
    }

    if (!heldPrev) {
      const nextValue = commitRootValue(root, newValue, prevValue, lane);

      if (nextValue !== UNCHANGED) {
        notify(root, lane, nextValue, prevValue);

        if (nextValue !== undefined) {
          settlePromise(root, true, nextValue);
        }
      }
    }
  }

  if (errors) {
    const errorInternals = root._errorControl![INTERNALS];

    const loadingInternals = root._loadingControl![INTERNALS];

    const readyInternals = root._readyControl![INTERNALS];

    const prevError: AggregateControlError | undefined = errorInternals._value;

    let nextLoadingValue = true;

    let nextReadyValue: undefined | true;

    let nextErrorValue: AggregateControlError | undefined;

    if (currentTarget) {
      if ('_errorControl' in currentTarget) {
        const errorInternals = currentTarget._errorControl[INTERNALS];

        const errorValue = errorInternals._value;

        if (isRetargeted) {
          const nextLoad = currentTarget._load;

          attachUntrackedNotifier(errorInternals, root._selfNotifier);

          if (nextLoad && root._activeCount) {
            currentTarget._attach(undefined, undefined, true);

            nextLoad._activeCount += root._activeCount - 1;
          }
        }

        if (errorValue === undefined) {
          if (errors[registry._depth] !== undefined) {
            errors[registry._depth] = errorValue;
          }
        } else if (errorValue !== errors[registry._depth]) {
          errors[registry._depth] = errorValue;

          nextErrorValue = new AggregateControlError(errors);
        } else {
          nextErrorValue = prevError;
        }

        nextLoadingValue = currentTarget._loadingControl[INTERNALS]._value;

        nextReadyValue = currentTarget._readyControl[INTERNALS]._value;
      } else {
        nextLoadingValue = root._value === undefined;

        nextReadyValue = !nextLoadingValue || undefined;
      }
    } else {
      const prevErrors = prevError && prevError.errors;

      let isError = false;

      /** Nothing to compare against is nothing the aggregate can be reused from. */
      let isChanged = !prevErrors;

      for (let i = 0, l = errors.length; i < l; i++) {
        const err = errors[i];

        if (err !== undefined) {
          isError = true;
        }

        if (prevErrors && err !== prevErrors[i]) {
          isChanged = true;
        }
      }

      if (isError) {
        nextLoadingValue = false;

        nextErrorValue = isChanged
          ? new AggregateControlError(errors)
          : prevError;
      }
    }

    root._holdingPrev = heldPrev;

    if (heldPrev) {
      // showing a held value: it's ready and its error is swallowed
      nextErrorValue = undefined;

      nextReadyValue = true;
    }

    commitErrorValue(root, errorInternals, nextErrorValue, lane);

    commitStatusValue(loadingInternals, nextLoadingValue, lane);

    commitStatusValue(readyInternals, nextReadyValue, lane);
  }

  sourceUpdate._value = false;
}

const attachNotifierToTargetNode = (
  root: ControlInternals,
  path: readonly string[],
  notifier: Notifier
) => {
  let children = root._children;

  let target: ControlInternalsChild | undefined = root;

  for (let i = 0, l = path.length; i < l; i++) {
    let key = path[i];

    const nextTarget = children && children.get(key);

    if (nextTarget === undefined) {
      let prevPath: readonly string[] = target._path || EMPTY_ARR;

      const endIndex = path.length - 1;

      if (children === undefined) {
        target._children = children = new Map();
      }

      while (i < endIndex) {
        prevPath = append(prevPath!, key);

        children.set(
          key,
          makeChildNode(root, prevPath, (children = new Map()), EMPTY_ARR)
        );

        key = path[++i];
      }

      const node = makeChildNode(
        root,
        path,
        undefined,
        (notifier._attachedTo = [notifier])
      );

      notifier._source = node;

      children.set(key, node);

      return;
    }

    target = nextTarget;

    children = target._children;
  }

  attachNotifier(target, notifier);
};

const loadAttach = (p: BoundInternals) => {
  const load = p._load;

  const target = p._target;

  p._activeCount++;

  if (load) {
    for (let i = 0, l = load.length; i < l; i++) {
      load[i]._attach(undefined, undefined, true);
    }
  }

  if (target) {
    target._attach(undefined, undefined, true);
  }
};

const loadDetach = (p: BoundInternals) => {
  const load = p._load;

  const target = p._target;

  p._activeCount--;

  if (load) {
    for (let i = 0, l = load.length; i < l; i++) {
      load[i]._detach(undefined, undefined, true);
    }
  }

  if (target) {
    target._detach(undefined, undefined, true);
  }
};

function attach(
  this: BoundInternals,
  control: BoundInternalsChild | undefined,
  listener: ChangeListener | undefined,
  isLoad: boolean
) {
  const self = this;

  if (
    control &&
    control._path !== undefined &&
    control._boundData === undefined
  ) {
    const notifier: Notifier = {
      _target: control,
      _notify: childNodeNotify,
      _index: 0,
      _attachedTo: EMPTY_ARR,
      _source: undefined,
    };

    (control as Mutable<typeof control>)._boundData = {
      _selfNotifier: notifier,
      _prevValue: undefined,
      _value: undefined,
    };

    self._activeNodes.push(control);

    if (self._target) {
      attachNotifierToTargetNode(self._target, control._path, notifier);
    }
  }

  if (listener) {
    addListener(control!, listener);
  }

  if (isLoad) {
    loadAttach(self);
  }
}

function detach(
  this: BoundInternals,
  control: BoundInternalsChild | undefined,
  listener: ChangeListener | undefined,
  isLoad: boolean
) {
  if (listener) {
    removeListener(control!, listener);
  }

  if (isLoad) {
    loadDetach(this);
  }
}

function errorAttach(
  this: ErrorControlInternals<BoundInternals>,
  control: ErrorControlInternals<BoundInternals> | undefined,
  listener: ChangeListener | undefined,
  isLoad: boolean
) {
  if (listener) {
    addListener(control!, listener);
  }

  if (isLoad) {
    loadAttach(this._parent);
  }
}

function errorDetach(
  this: ErrorControlInternals<BoundInternals>,
  control: ErrorControlInternals<BoundInternals> | undefined,
  listener: ChangeListener | undefined,
  isLoad: boolean
) {
  if (listener) {
    removeListener(control!, listener);
  }

  if (isLoad) {
    loadDetach(this._parent);
  }
}

/** Skips `_attachedTo` tracking: rebinds remove these via `cleanupPrevTarget` instead. */
const attachUntrackedNotifier = (
  targetInternals: ControlInternalsBase,
  notifier: Notifier
) => {
  const dependents = targetInternals._dependents;

  if (dependents != EMPTY_ARR) {
    dependents.push(notifier);
  } else {
    (targetInternals as Mutable<ControlInternalsBase>)._dependents = [notifier];
  }
};

/**
 * Whatever moved while the subscription was down: the keys it binds to and the
 * errors they carry. A key that moved is another item, so the target is let go
 * of and the commit below resolves it again.
 */
function resyncBound(this: BoundInternals) {
  const root = this;

  root._pending = undefined;

  const sources = root._sources;

  const keys = root._keys;

  const errors = root._errors;

  /** A key moved, so the item it binds to is another one. */
  let changed = false;

  for (let index = 0, l = sources.length; index < l; index++) {
    const source = sources[index];

    if (source === undefined) {
      continue;
    }

    actualizePending(source._root);

    const errorControl = (source._root as AsyncControlInternals)._errorControl;

    if (errorControl && errors) {
      errors[index] = errorControl[INTERNALS]._value;
    }

    const value = source._get();

    if (value !== keys[index]) {
      keys[index] = value;

      changed = true;

      holdPrev(root, index);
    }
  }

  if (changed) {
    cleanupPrevTarget(root);
  }

  // unconditionally: the target is attached by the commit, so while it is not,
  // the item moving on its own is something only the commit can see - a key
  // that never moved says nothing about the value behind it. Nothing is
  // notified - see `resyncDerived`
  root._commitSet(null, silentLane);
}

function subscribeBound(this: BoundInternals) {
  const notifiers = this._notifiers;

  for (let i = 0, l = notifiers.length; i < l; i++) {
    const notifier = notifiers[i];

    attachNotifier(notifier._source, notifier);
  }

  const sources = this._sources;

  for (let i = 0, l = sources.length; i < l; i++) {
    const source = sources[i];

    if (source) {
      // a no-op unless the source is a bound child, which has to be active
      // before it holds anything
      source._root._attach(source, undefined, false);
    }
  }

  const target = this._target;

  // the commit attaches whatever it resolves and a cleanup lets it go again, so
  // the only target reaching this is the one the creation resolved
  if (target) {
    attachUntrackedNotifier(target, this._selfNotifier);

    if ('_errorControl' in target) {
      attachUntrackedNotifier(
        target._errorControl[INTERNALS],
        this._selfNotifier
      );
    }
  }

  // nobody read it while it was detached, so the catch-up is still owed
  if (this._pending) {
    this._resync();
  }
}

function cleanupBound(this: BoundInternals) {
  this._pending = this;

  cleanupPrevTarget(this);

  const notifiers = this._notifiers;

  for (let i = 0, l = notifiers.length; i < l; i++) {
    const notifier = notifiers[i];

    const attachedTo = notifier._attachedTo;

    if (attachedTo != EMPTY_ARR) {
      removeFromArray(attachedTo, notifier);

      notifier._attachedTo = EMPTY_ARR;
    }
  }
}

/**
 * A control mirroring the registry item under the current values of its
 * {@link keys}, retargeting whenever one of them moves. Every call builds its
 * own - nothing is cached, so its lifetime is the caller's.
 */
const makeBoundControl = (registry: Registry<any, any>, keys: any[]): any => {
  const depth = getRegistryDepth(registry, keys);

  const loadableDependencies: ControlInternals[] = [];

  const seenLoadableRoots = new Set<ControlInternals>();

  const notifiers: Notifier[] = [];

  const sources: Array<ControlInternalsChild | undefined> = Array(depth);

  let errors: any[] | undefined;

  let isError = false;

  let maxLevel = 0;

  let isReady = true;

  const boundInternals: BoundInternals = {
    _load: undefined,
    _children: undefined,
    _dependents: EMPTY_ARR,
    _enqueueSet: enqueueBoundSet,
    _get: readRootValue,
    _indexMap: undefined,
    _keys: keys,
    _value: undefined,
    _level: 0,
    _listeners: EMPTY_ARR,
    _path: undefined,
    _registry: registry,
    _storage: undefined,
    _setExternal: noop,
    _target: undefined,
    _root: undefined!,
    _pending: undefined,
    _attach: attach,
    _detach: detach,
    _activeCount: 0,
    _sources: sources,
    _notifiers: notifiers,
    _subscribe: subscribeBound,
    _cleanup: cleanupBound,
    _resync: resyncBound,
    _holdingPrev: false,
    _fromSource: false,
    _activeNodes: [],
    _changedNodes: [],
    _commitSet: commitSet,
    _selfNotifier: undefined!,
    _errorControl: undefined,
    _loadingControl: undefined,
    _promise: undefined,
    _readyControl: undefined,
    _errors: undefined,
  };

  const rootNotifier: Notifier = {
    _target: boundInternals,
    _notify: targetChangeNotify,
    _index: 0,
    _attachedTo: EMPTY_ARR,
    _source: undefined,
  };

  (boundInternals as Mutable<BoundInternals>)._selfNotifier = rootNotifier;

  (boundInternals as Mutable<BoundInternals>)._root = boundInternals;

  for (let j = 0; j < depth; j++) {
    const item = keys[j];

    const internals: ControlInternalsChild | undefined =
      item && item[INTERNALS];

    if (internals) {
      const root = internals._root;

      const errorControl = (root as BoundInternals)._errorControl;

      const keyValue = (keys[j] = internals._get());

      if (root._level > maxLevel) {
        maxLevel = root._level;
      }

      if (isReady && keyValue === undefined) {
        isReady = false;
      }

      if (errorControl) {
        const errorInternals = errorControl[INTERNALS];

        const errorValue = errorInternals._value;

        const errorNotifier: Notifier = {
          _target: boundInternals,
          _notify: keyErrorChangeNotify,
          _index: j,
          _attachedTo: EMPTY_ARR,
          _source: errorInternals,
        };

        if (errors === undefined) {
          (boundInternals as Mutable<BoundInternals>)._errors = errors = Array(
            depth + 1
          );
        }

        if (errorValue !== undefined) {
          errors[j] = errorValue;

          isError = true;
        }

        notifiers.push(errorNotifier);
      }

      sources[j] = internals;

      notifiers.push({
        _target: boundInternals,
        _notify: keyChangeNotify,
        _index: j,
        _attachedTo: EMPTY_ARR,
        _source: internals,
      });

      if (root._load && !seenLoadableRoots.has(root)) {
        loadableDependencies.push(root);

        seenLoadableRoots.add(root);
      }
    }
  }

  let controlType = registry._type;

  let targetInternals: ControlInternals | AsyncControlInternals | undefined;

  (boundInternals as Mutable<BoundInternals>)._level = ++maxLevel;

  if (isReady) {
    targetInternals = getNextTarget(registry, keys);

    // an item is what the registry reads its type off, and it has one now
    controlType = registry._type;

    boundInternals._value = targetInternals!._value;

    boundInternals._target = targetInternals;
  } else if (controlType == ControlType.UNDEFINED) {
    const initArg = registry._initArg as any;

    // nothing was ever asked of the registry, so there is no item to read it
    // off: one built off to the side answers it, without the default value - a
    // factory of the keys has none to be called with here, and what kind of
    // control this is is not something it has a say in anyway
    registry._type = controlType = getControlType(
      registry._createControl(
        typeof initArg == 'function'
          ? undefined
          : initArg && initArg.initialValue !== undefined
            ? { ...initArg, initialValue: undefined }
            : initArg,
        undefined,
        undefined
      )[INTERNALS] as ControlInternals
    );
  }

  let isLoadable = false;

  if (loadableDependencies.length) {
    (boundInternals as Mutable<BoundInternals>)._load = loadableDependencies;

    isLoadable = true;
  } else if (controlType == ControlType.LOADABLE) {
    (boundInternals as Mutable<BoundInternals>)._load = EMPTY_ARR;

    isLoadable = true;
  }

  if (controlType != ControlType.SYNC || errors) {
    let loadingValue = true;

    let readyValue: undefined | true;

    if (errors === undefined) {
      (boundInternals as Mutable<BoundInternals>)._errors = errors = Array(
        depth + 1
      );
    }

    if (isReady) {
      if ('_errorControl' in targetInternals!) {
        const errorInternals = targetInternals._errorControl[INTERNALS];

        const currErrorValue = errorInternals._value;

        loadingValue = targetInternals._loadingControl[INTERNALS]._value;

        readyValue = targetInternals._readyControl[INTERNALS]._value;

        if (currErrorValue !== undefined) {
          errors[depth] = currErrorValue;

          isError = true;
        }
      } else {
        loadingValue = boundInternals._value === undefined;

        readyValue = !loadingValue || undefined;
      }
    }

    const errorInternals: ErrorControlInternals<BoundInternals> = {
      _root: undefined!,
      _pending: undefined,
      _attach: errorAttach,
      _detach: errorDetach,
      _dependents: EMPTY_ARR,
      _enqueueSet: enqueueBoundErrorSet,
      _get: readRootValue,
      _indexMap: undefined,
      _level: maxLevel,
      _listeners: EMPTY_ARR,
      _load: isLoadable,
      _parent: boundInternals,
      _path: undefined,
      _value: isError ? new AggregateControlError(errors!) : undefined,
    };

    (errorInternals as Mutable<typeof errorInternals>)._root = errorInternals;

    (boundInternals as Mutable<BoundInternals>)._loadingControl = {
      [INTERNALS]: makeStatusInternals(boundInternals, loadingValue),
    };

    (boundInternals as Mutable<BoundInternals>)._readyControl = {
      [INTERNALS]: makeStatusInternals(boundInternals, readyValue),
    };

    (boundInternals as Mutable<BoundInternals>)._errorControl = {
      [INTERNALS]: errorInternals,
    };
  }

  registerSubscription(boundInternals, boundInternals);

  return createScope(boundInternals);
};

export default makeBoundControl;
