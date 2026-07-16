import type { PrimitiveOrNested } from 'keyweaver';
import noop from 'lodash.noop';
import type {
  Registry,
  AsyncControlOptions,
  AsyncControlScope,
  ControlScope,
  Control,
  RegistryOptions,
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
} from '#internal/types';
import type _createControl from '#core/createControl';
import type _createAsyncControl from '#core/createAsyncControl';
import type _createPrimitiveControl from '#core/createPrimitiveControl';
import invalidate from '#core/invalidate';
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
import { commitNextValue, UNCHANGED } from '#internal/commitPatchNode';
import removeFromArray from '#internal/removeFromArray';
import attachNotifier from '#internal/attachNotifier';
import makeChildNode from '#internal/makeChildNode';
import getStorageKey from '#internal/getStorageKey';
import getObjectKey from '#internal/getObjectKey';
import makeStatusInternals from '#internal/makeStatusInternals';
import settlePromise from '#internal/settlePromise';
import { AggregateControlError } from '#internal/AggregateControlError';
import throwReadonlyError from '#internal/throwReadonlyError';
import { commitErrorValue, commitStatusValue } from '#internal/commitStatus';

type Undefinable<O extends {}> = {
  [key in keyof O]: O[key] | undefined;
};

interface BoundInternals
  extends ControlInternals, Undefinable<AsyncStatusControls<BoundInternals>> {
  _activeCount: number;
  _holdingPrev: boolean;
  _target: ControlInternals | AsyncControlInternals | undefined;
  readonly _activeNodes: BoundInternalsChild[];
  readonly _changedNodes: BoundInternalsChild[];
  readonly _notifiers: Notifier[];
  readonly _selfNotifier: Notifier;
  _keys: any[];
  readonly _load: ReadonlyArray<ControlInternals> | undefined;
  readonly _registry: Registry<any, any>;
  readonly _errors: any[] | undefined;
}

type BoundInternalsChild = ChildControlNode<BoundInternals>;

/** Control keys map by internals identity, plain keys by a canonical token object. */
const keyToBoundKey = (kv: any) =>
  (kv && kv[INTERNALS]) || getObjectKey(getStorageKey(kv));

const getControlType = (internals: ControlInternals | AsyncControlInternals) =>
  internals._load
    ? ControlType.LOADABLE
    : '_errorControl' in internals
      ? ControlType.ASYNC
      : ControlType.SYNC;

function enqueueBoundSet(
  this: BoundInternals,
  value: any,
  lane: Lane,
  path: string[] | undefined
) {
  const target = this._target;

  if (target) {
    target._enqueueSet(value, lane, path);
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
  path: string[] | undefined
) {
  if (value !== RELOAD && value !== SILENT_RELOAD) {
    throwReadonlyError();
  }

  const target = this._parent._target;

  if (target && '_errorControl' in target) {
    (target as AsyncControlInternals)._errorControl[INTERNALS]._enqueueSet(
      value,
      lane,
      path
    );
  } else if (process.env.NODE_ENV !== 'production') {
    console.warn(
      '[registry] invalidate on bound control with unresolved or non-async target was ignored.'
    );
  }
}

const childNodeNotify = (
  _: Lane,
  node: BoundInternalsChild,
  value: any,
  prevValue: any
) => {
  const data = node._boundData!;

  data._value = value;

  data._prevValue = prevValue;

  node._root._changedNodes.push(node);
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
    }

    if (root._changedNodes.length) {
      root._changedNodes.length = 0;
    }
  }
};

function keyChangeNotify(
  this: Notifier,
  lane: Lane,
  root: BoundInternals,
  value: any,
  _: any
) {
  root._keys[this._index] = value;

  // (re)decide the hold on each change while a target is attached or a hold is
  // ongoing; a stale false when targetless and not holding is harmless
  if (root._target || root._holdingPrev) {
    const keepPrev = root._registry._keepPrev;

    root._holdingPrev =
      keepPrev &&
      (typeof keepPrev == 'boolean' ? keepPrev : keepPrev[this._index]);
  }

  cleanupPrevTarget(root);

  addToQueue(lane, root);
}

function keyErrorChangeNotify(
  this: Notifier,
  lane: Lane,
  root: BoundInternals,
  value: any,
  _: any
) {
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

    nextStorage = nextStorage && storage.get(key);

    if (nextStorage) {
      storage = nextStorage;
    } else {
      storage.set(key, (storage = new Map()));
    }
  }

  const key = keys[endIndex];

  if (key !== undefined) {
    let control: ControlScope | Control | AsyncControlScope =
      nextStorage && storage.get(key);

    if (control === undefined) {
      storage.set(
        key,
        (control = registry._createControl(
          registry._initArg,
          registry._externalStorage,
          keys
        ))
      );
    }

    return control[INTERNALS] as ControlInternals;
  }
};

function commitSet(this: BoundInternals, _: any, lane: Lane) {
  const root = this;

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
        for (let i = 0, l = changedNodes.length; i < l; i++) {
          const node = changedNodes[i];

          const data = node._boundData!;

          const { _prevValue: prevValue, _value: nextValue } = data;

          data._prevValue = undefined;

          data._value = undefined;

          notify(node._listeners, node._dependents, lane, nextValue, prevValue);
        }

        changedNodes.length = 0;

        root._value = value;

        notify(root._listeners, root._dependents, lane, value, prevValue);

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
          for (let i = registry._depth; i--; ) {
            if (errors[i] !== undefined) {
              heldPrev = false;

              break;
            }
          }
        }
      }
    }

    if (!heldPrev) {
      const nextValue = commitNextValue(newValue, prevValue, root, lane);

      if (nextValue !== UNCHANGED) {
        root._value = nextValue;

        notify(root._listeners, root._dependents, lane, nextValue, prevValue);

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
      if (prevError) {
        const prevErrors = prevError.errors;

        let isError = false;

        let isChanged = false;

        for (let i = 0, l = errors.length; i < l; i++) {
          const err = errors[i];

          if (err !== undefined) {
            isError = true;
          }

          if (err !== prevErrors[i]) {
            isChanged = true;
          }
        }

        if (isError) {
          nextLoadingValue = false;

          nextErrorValue = isChanged
            ? new AggregateControlError(errors)
            : prevError;
        }
      } else {
        for (let i = 0, l = errors.length; i < l; i++) {
          if (errors[i] !== undefined) {
            nextLoadingValue = false;

            nextErrorValue = new AggregateControlError(errors);

            break;
          }
        }
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

      children.set(
        key,
        makeChildNode(
          root,
          path,
          undefined,
          (notifier._attachedTo = [notifier])
        )
      );

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

  if (control) {
    if (control._path !== undefined && !control._listeners.length) {
      const target = self._target;

      const data = control._boundData;

      let notifier: Notifier;

      if (data === undefined) {
        (control as Mutable<typeof control>)._boundData = {
          _selfNotifier: (notifier = {
            _ref: new WeakRef(control),
            _notify: childNodeNotify,
            _index: 0,
            _attachedTo: EMPTY_ARR,
          }),
          _prevValue: undefined,
          _value: undefined,
        };
      } else {
        notifier = data._selfNotifier;
      }

      self._activeNodes.push(control);

      if (target) {
        attachNotifierToTargetNode(target, control._path, notifier);
      }
    }

    addListener(control, listener!);
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
  const self = this;

  if (control) {
    removeListener(control, listener!);

    if (control._path !== undefined && !control._listeners.length) {
      const target = self._target;

      removeFromArray(self._activeNodes, control);

      if (target) {
        const notifier = control._boundData!._selfNotifier;

        removeFromArray(notifier._attachedTo!, notifier);

        notifier._attachedTo = EMPTY_ARR;
      }
    }
  }

  if (isLoad) {
    loadDetach(self);
  }
}

function errorAttach(
  this: ErrorControlInternals<BoundInternals>,
  control: ErrorControlInternals<BoundInternals> | undefined,
  listener: ChangeListener | undefined,
  isLoad: boolean
) {
  if (control) {
    addListener(control, listener!);
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
  if (control) {
    removeListener(control, listener!);
  }

  if (isLoad) {
    loadDetach(this._parent);
  }
}

function registryDelete(this: Registry<any, any>, ...keys: any[]) {
  const self = this;

  const registryDepth = self._depth;

  if (registryDepth == 0) {
    return false;
  }

  const depth = keys.length;

  const endIndex = depth - 1;

  let storage = self._storage;

  for (let i = 0; true; i++) {
    const keyValue = keys[i];

    if (keyValue === undefined) {
      throwUndefinedError();
    }

    if (keyValue && keyValue[INTERNALS]) {
      let bound = self._bound;

      for (let j = 0; j < endIndex && bound; j++) {
        bound = bound.get(keyToBoundKey(keys[j]));
      }

      if (bound === undefined) {
        return false;
      }

      const lastKey = keyToBoundKey(keys[endIndex]);

      const boundControl: ControlScope | undefined = bound.get(lastKey);

      if (boundControl == undefined) {
        return false;
      }

      if (depth == registryDepth) {
        const boundInternals = boundControl[INTERNALS] as BoundInternals;

        const notifiers = boundInternals._notifiers;

        cleanupPrevTarget(boundInternals);

        for (let i = 0, l = notifiers.length; i < l; i++) {
          const notifier = notifiers[i];

          removeFromArray(notifier._attachedTo!, notifier);
        }
      }

      return bound.delete(lastKey);
    }

    if (i == endIndex) {
      return storage.delete(getStorageKey(keyValue));
    }

    storage = storage.get(getStorageKey(keyValue));

    if (storage === undefined) {
      return false;
    }
  }
}

function clear(this: Registry<any, any[]>) {
  this._storage.clear();

  (this as Mutable<typeof this>)._bound = undefined;
}

function registryInvalidate(
  this: Registry<any, any>,
  ...keys: PrimitiveOrNested[]
) {
  const registryDepth = this._depth;

  if (registryDepth != 0) {
    const depth = keys.length;

    let storage = this._storage;

    for (let i = 0; i < depth; i++) {
      storage = storage.get(getStorageKey(keys[i]))!;

      if (storage === undefined) {
        return;
      }
    }

    if (registryDepth == depth) {
      invalidate(storage as any);
    } else {
      let queue: Map<any, any>[] = [storage];

      for (let i = 0, diff = registryDepth - depth - 1; i < diff; i++) {
        const nextQueue: Map<any, any>[] = [];

        for (let i = 0, l = queue.length; i < l; i++) {
          const storage = queue[i];

          const it = storage.values();

          for (let i = storage.size; i--; ) {
            nextQueue.push(it.next().value);
          }
        }

        queue = nextQueue;
      }

      for (let i = 0, l = queue.length; i < l; i++) {
        const storage = queue[i];

        const it = storage.values();

        for (let i = storage.size; i--; ) {
          invalidate(it.next().value);
        }
      }
    }
  }
}

const throwUndefinedError = () => {
  throw new Error('Undefined cannot be used as a registry key.');
};

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

const getRegistryDepth = (registry: Registry<any, any>, keys: any[]) => {
  const depth = keys.length;

  const registryDepth = registry._depth;

  if (registryDepth != depth) {
    if (registryDepth) {
      throw new Error('inconsistent registry depth');
    }

    (registry as Mutable<typeof registry>)._depth = depth;
  }

  return depth;
};

function get(this: Registry<any, any>, ...keys: any[]): any {
  const self = this;

  const endIndex = getRegistryDepth(self, keys) - 1;

  let storage = self._storage;

  for (let i = 0; i < endIndex; i++) {
    const keyValue = keys[i];

    if (keyValue === undefined) {
      throwUndefinedError();
    }

    const storageKey = getStorageKey(keyValue);

    const nextStorage = storage.get(storageKey);

    if (nextStorage) {
      storage = nextStorage;
    } else {
      storage.set(storageKey, (storage = new Map()));

      while (++i < endIndex) {
        const keyValue = keys[i];

        if (keyValue === undefined) {
          throwUndefinedError();
        }

        storage.set(getStorageKey(keyValue), (storage = new Map()));
      }

      break;
    }
  }

  const keyValue = keys[endIndex];

  if (keyValue === undefined) {
    throwUndefinedError();
  }

  const storageKey = getStorageKey(keyValue);

  let control = storage.get(storageKey);

  if (control === undefined) {
    storage.set(
      storageKey,
      (control = self._createControl(
        self._initArg,
        self._externalStorage,
        keys
      ))
    );

    if (self._type == ControlType.UNDEFINED) {
      self._type = getControlType(control[INTERNALS]);
    }
  }

  return control;
}

function bind(this: Registry<any, any>, ...keys: any[]): any {
  const self = this;

  const depth = getRegistryDepth(self, keys);

  const endIndex = depth - 1;

  let bound = self._bound;

  if (bound === undefined) {
    self._bound = bound = new WeakMap();
  }

  for (let i = 0; ; i++) {
    const item = keys[i];

    if (item === undefined) {
      throwUndefinedError();
    }

    const nextBound: typeof bound = bound.get(keyToBoundKey(item));

    if (nextBound) {
      if (i == endIndex) {
        return nextBound;
      }

      bound = nextBound;
    } else {
      const loadableDependencies: ControlInternals[] = [];

      const seenLoadableRoots = new Set<ControlInternals>();

      const notifiers: Notifier[] = [];

      let errors: any[] | undefined;

      let isError = false;

      let maxLevel = 0;

      let storage = self._storage;

      let controlExists = true;

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
        _registry: self,
        _storage: undefined,
        _setExternal: noop,
        _target: undefined,
        _root: undefined!,
        _attach: attach,
        _detach: detach,
        _activeCount: 0,
        _holdingPrev: false,
        _activeNodes: [],
        _changedNodes: [],
        _notifiers: notifiers,
        _commitSet: commitSet,
        _selfNotifier: undefined!,
        _errorControl: undefined,
        _loadingControl: undefined,
        _promise: undefined,
        _readyControl: undefined,
        _errors: undefined,
      };

      const weakRef = new WeakRef(boundInternals);

      const rootNotifier: Notifier = {
        _ref: weakRef,
        _notify: addToQueue,
        _index: 0,
        _attachedTo: EMPTY_ARR,
      };

      (boundInternals as Mutable<BoundInternals>)._selfNotifier = rootNotifier;

      (boundInternals as Mutable<BoundInternals>)._root = boundInternals;

      for (let j = 0; ; j++) {
        let keyValue;

        const item = keys[j];

        const internals: ControlInternalsChild | undefined =
          item && item[INTERNALS];

        if (internals) {
          const root = internals._root;

          const errorControl = (root as BoundInternals)._errorControl;

          keys[j] = keyValue = internals._get();

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
              _ref: weakRef,
              _notify: keyErrorChangeNotify,
              _index: j,
              _attachedTo: EMPTY_ARR,
            };

            if (errors === undefined) {
              (boundInternals as Mutable<BoundInternals>)._errors = errors =
                Array(depth + 1);
            }

            if (errorValue !== undefined) {
              errors[j] = errorValue;

              isError = true;
            }

            attachNotifier(errorInternals, errorNotifier);

            notifiers.push(errorNotifier);
          }

          const notifier: Notifier = {
            _ref: weakRef,
            _notify: keyChangeNotify,
            _index: j,
            _attachedTo: EMPTY_ARR,
          };

          attachNotifier(internals, notifier);

          notifiers.push(notifier);

          if (root._load && !seenLoadableRoots.has(root)) {
            loadableDependencies.push(root);

            seenLoadableRoots.add(root);
          }
        } else {
          keyValue = item;

          if (keyValue === undefined) {
            throwUndefinedError();
          }
        }

        const storageKey = getStorageKey(keyValue);

        // notifiers attach for every key; bound-tree nodes only from the miss point on
        if (j >= i) {
          if (j == endIndex) {
            let controlType = self._type;

            let targetInternals:
              | ControlInternals
              | AsyncControlInternals
              | undefined;

            (boundInternals as Mutable<BoundInternals>)._level = ++maxLevel;

            if (isReady) {
              let control:
                | ControlScope
                | Control
                | AsyncControlScope
                | undefined = controlExists
                ? storage.get(storageKey)
                : undefined;

              if (!control) {
                storage.set(
                  storageKey,
                  (control = self._createControl(
                    self._initArg,
                    self._externalStorage,
                    keys
                  ))
                );
              }

              targetInternals = control![INTERNALS] as ControlInternals;

              if (controlType == ControlType.UNDEFINED) {
                self._type = controlType = getControlType(targetInternals);
              }

              boundInternals._value = targetInternals._value;

              boundInternals._target = targetInternals;

              attachUntrackedNotifier(targetInternals, rootNotifier);
            } else if (controlType == ControlType.UNDEFINED) {
              self._type = controlType = getControlType(
                self._createControl(self._initArg, undefined, undefined)[
                  INTERNALS
                ] as ControlInternals
              );
            }

            let isLoadable = false;

            if (loadableDependencies.length) {
              (boundInternals as Mutable<BoundInternals>)._load =
                loadableDependencies;

              isLoadable = true;
            } else if (controlType == ControlType.LOADABLE) {
              (boundInternals as Mutable<BoundInternals>)._load = EMPTY_ARR;

              isLoadable = true;
            }

            if (controlType != ControlType.SYNC || errors) {
              let loadingValue = true;

              let readyValue: undefined | true;

              if (errors === undefined) {
                (boundInternals as Mutable<BoundInternals>)._errors = errors =
                  Array(depth + 1);
              }

              if (isReady) {
                if ('_errorControl' in targetInternals!) {
                  const errorInternals =
                    targetInternals._errorControl[INTERNALS];

                  const currErrorValue = errorInternals._value;

                  loadingValue =
                    targetInternals._loadingControl[INTERNALS]._value;

                  readyValue = targetInternals._readyControl[INTERNALS]._value;

                  if (currErrorValue !== undefined) {
                    errors[depth] = currErrorValue;

                    isError = true;
                  }

                  attachUntrackedNotifier(errorInternals, rootNotifier);
                } else {
                  loadingValue = boundInternals._value === undefined;

                  readyValue = !loadingValue || undefined;
                }
              }

              const errorInternals: ErrorControlInternals<BoundInternals> = {
                _root: undefined!,
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
                _value: isError
                  ? new AggregateControlError(errors!)
                  : undefined,
              };

              (errorInternals as Mutable<typeof errorInternals>)._root =
                errorInternals;

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

            const boundControl = createScope(boundInternals);

            bound.set(internals || getObjectKey(storageKey), boundControl);

            return boundControl;
          }

          bound.set(
            internals || getObjectKey(storageKey),
            (bound = new WeakMap())
          );
        }

        if (isReady) {
          if (controlExists) {
            const nextStorage = storage.get(storageKey);

            if (nextStorage) {
              storage = nextStorage;
            } else {
              controlExists = false;

              storage.set(storageKey, (storage = new Map()));
            }
          } else {
            storage.set(storageKey, (storage = new Map()));
          }
        }
      }
    }
  }
}

const createRegistry: {
  /**
   * Creates a {@link Registry registry} of {@link AsyncControlScope async
   * controls} keyed by tuples: `get(...keys)` lazily creates (and caches) one
   * control per distinct key set, passing the keys to the
   * {@link AsyncControlOptions options} (`value`, a loader's `fetch`, etc).
   *
   * Keys are compared structurally, so objects and arrays are valid keys.
   * `bind(...keys)` also accepts controls as keys: it returns a control that
   * mirrors the item under their current values and rebinds when a key
   * control changes — the {@link registryOptions} `keepPrev` option keeps it
   * showing the previous value while the new item loads.
   * `invalidate(...keys)` resets all items under the given key prefix.
   *
   * @example
   * ```ts
   * const userRegistry = createRegistry(createAsyncControl, {
   *   ...requestLoader((id: number) =>
   *     fetch(`/api/users/${id}`).then((r) => r.json())
   *   ),
   * });
   *
   * const $user = userRegistry.get(42);
   *
   * // bound: retargets whenever $selectedId's value changes
   * const $selectedUser = userRegistry.bind($selectedId);
   * ```
   */
  <T, Keys extends Exclude<PrimitiveOrNested, undefined>[], E = any>(
    createAsyncControl: typeof _createAsyncControl,
    options?: AsyncControlOptions<T, E, Keys>,
    registryOptions?: RegistryOptions<T | undefined, Keys>
  ): Registry<AsyncControlScope<T, E>, Keys>;
  /**
   * Creates a {@link Registry registry} of sync {@link ControlScope controls}
   * keyed by tuples: `get(...keys)` lazily creates (and caches) one control
   * per distinct key set, resolving {@link defaultValue} with the keys.
   *
   * @example
   * ```ts
   * const draftRegistry = createRegistry(createControl, (chatId: string) => '');
   *
   * const $draft = draftRegistry.get('chat-1');
   * ```
   */
  <T, Keys extends Exclude<PrimitiveOrNested, undefined>[]>(
    createControl: typeof _createControl,
    defaultValue?: T | ((...keys: Keys) => T),
    registryOptions?: RegistryOptions<T, Keys>
  ): Registry<ControlScope<T>, Keys>;
  /**
   * Creates a {@link Registry registry} of primitive {@link Control controls}
   * keyed by tuples: `get(...keys)` lazily creates (and caches) one control
   * per distinct key set, resolving {@link defaultValue} with the keys. Items
   * skip the scope proxy — values are opaque (no nested-path access), making
   * this the cheapest registry flavor for simple values.
   *
   * @example
   * ```ts
   * const expandedRegistry = createRegistry(
   *   createPrimitiveControl,
   *   (sectionId: string) => false
   * );
   *
   * const $expanded = expandedRegistry.get('intro');
   * ```
   */
  <T, Keys extends Exclude<PrimitiveOrNested, undefined>[]>(
    createControl: typeof _createPrimitiveControl,
    defaultValue?: T | ((...keys: Keys) => T),
    registryOptions?: RegistryOptions<T, Keys>
  ): Registry<Control<T>, Keys>;
} = (createControl: any, arg1?: unknown, options?: RegistryOptions): any =>
  ({
    _storage: new Map(),
    _bound: undefined,
    delete: registryDelete,
    get,
    bind,
    invalidate: registryInvalidate,
    clear,
    _createControl: createControl,
    _initArg: arg1,
    _externalStorage: options && options.externalStorage,
    _type: ControlType.UNDEFINED,
    _depth: 0,
    _keepPrev: (options && options.keepPrev) || false,
    _suppressError: (options && options.suppressError) || false,
  }) as Registry<any, any[]>;

export default createRegistry;
