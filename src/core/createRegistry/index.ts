import type { PrimitiveOrNested } from 'keyweaver';
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
  AsyncThings,
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
import { addListener, removeListener } from '#internal/flushQueue';
import addToQueue from '#internal/addToQueue';
import { commitNextValue, UNCHANGED } from '#internal/commitPatchNode';
import notify from '#internal/notify';
import removeFromArray from '#internal/removeFromArray';
import attachNotifier from '#internal/attachNotifier';
import makeChildNode from '#internal/makeChildNode';
import getStorageKey from '#internal/getStorageKey';
import getToken from '#internal/getToken';
import makeStatusInternals from '#internal/makeStatusInternals';
import settlePromise from '#internal/settlePromise';
import { AggregateControlError } from '#internal/AggregateControlError';
import throwReadonlyError from '#internal/throwReadonlyError';
import { commitErrorValue, commitStatusValue } from '#internal/commitStatus';

type Undefinable<O extends {}> = {
  [key in keyof O]: O[key] | undefined;
};

interface BoundedInternals
  extends ControlInternals, Undefinable<AsyncThings<BoundedInternals>> {
  _activeCount: number;
  _target: ControlInternals | AsyncControlInternals | undefined;
  readonly _activeNodes: BoundedInternalsChild[];
  readonly _changedNodes: BoundedInternalsChild[];
  readonly _notifiers: Notifier[];
  readonly _selfNotifier: Notifier;
  _keys: any[];
  readonly _load: ReadonlyArray<ControlInternals> | undefined;
  readonly _registry: Registry<any, any>;
  readonly _errors: any[] | undefined;
}

type BoundedInternalsChild = ChildControlNode<BoundedInternals>;

const keyToBoundedKey = (kv: any) =>
  (kv && kv[INTERNALS]) || getToken(getStorageKey(kv));

const getControlType = (internals: ControlInternals | AsyncControlInternals) =>
  internals._load
    ? ControlType.LOADABLE
    : '_errorControl' in internals
      ? ControlType.ASYNC
      : ControlType.SYNC;

function enqueueBoundedSet(
  this: BoundedInternals,
  value: any,
  lane: Lane,
  path: string[] | undefined
) {
  const target = this._target;

  if (target) {
    target._enqueueSet(value, lane, path);
  } else if (process.env.NODE_ENV !== 'production') {
    console.warn(
      '[registry] setValue on bounded control with unresolved keys was ignored. Wait for all key controls to be ready before writing.'
    );
  }
}

function enqueueBoundedErrorSet(
  this: ErrorControlInternals<BoundedInternals>,
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
      '[registry] invalidate on bounded control with unresolved or non-async target was ignored.'
    );
  }
}

const childNodeNotify = (
  _: Lane,
  node: BoundedInternalsChild,
  value: any,
  prevValue: any
) => {
  const data = node._data!;

  data._value = value;

  data._prevValue = prevValue;

  node._root._changedNodes.push(node);
};

const cleanupPrevTarget = (root: BoundedInternals) => {
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
      const notifier = activeNodes[i]._data!._selfNotifier;

      removeFromArray(notifier._current!, notifier);

      notifier._current = EMPTY_ARR;
    }

    if (root._changedNodes.length) {
      root._changedNodes.length = 0;
    }
  }
};

function keyChangeNotify(
  this: Notifier,
  lane: Lane,
  root: BoundedInternals,
  value: any,
  _: any
) {
  root._keys[this._index] = value;

  cleanupPrevTarget(root);

  addToQueue(lane, root);
}

function keyErrorChangeNotify(
  this: Notifier,
  lane: Lane,
  root: BoundedInternals,
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
          registry._arg1,
          registry._externalStorage,
          keys
        ))
      );
    }

    return control[INTERNALS] as ControlInternals;
  }
};

function commitSet(this: BoundedInternals, _: any, lane: Lane) {
  const root = this;

  const errors = root._errors;

  const prevValue = root._value;

  const registry = root._registry;

  let currentTarget = root._target;

  const isRetargeted = !currentTarget;

  if (currentTarget) {
    const changedNodes = root._changedNodes;

    const value = currentTarget._value;

    if (value !== prevValue) {
      for (let i = 0, l = changedNodes.length; i < l; i++) {
        const node = changedNodes[i];

        const data = node._data!;

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
  } else {
    const activeNodes = root._activeNodes;

    currentTarget = getNextTarget(registry, root._keys);

    if (currentTarget) {
      attachNotifierWithoutCurrentChange(currentTarget, root._selfNotifier);

      for (let i = 0, l = activeNodes.length; i < l; i++) {
        const node = activeNodes[i];

        attachNotifierToTargetNode(
          currentTarget,
          node._path!,
          node._data!._selfNotifier
        );
      }

      root._target = currentTarget;
    }

    const nextValue = commitNextValue(
      currentTarget && currentTarget._value,
      prevValue,
      root,
      lane
    );

    if (nextValue !== UNCHANGED) {
      root._value = nextValue;

      notify(root._listeners, root._dependents, lane, nextValue, prevValue);

      if (nextValue !== undefined) {
        settlePromise(root, true, nextValue);
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

          attachNotifierWithoutCurrentChange(
            errorInternals,
            root._selfNotifier
          );

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
        makeChildNode(root, path, undefined, (notifier._current = [notifier]))
      );

      return;
    }

    target = nextTarget;

    children = target._children;
  }

  attachNotifier(target, notifier);
};

const loadAttach = (p: BoundedInternals) => {
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

const loadDetach = (p: BoundedInternals) => {
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
  this: BoundedInternals,
  control: BoundedInternalsChild | undefined,
  listener: ChangeListener | undefined,
  isLoad: boolean
) {
  const self = this;

  if (control) {
    if (control._path !== undefined && !control._listeners.length) {
      const target = self._target;

      const data = control._data;

      let notifier: Notifier;

      if (data === undefined) {
        (control as Mutable<typeof control>)._data = {
          _selfNotifier: (notifier = {
            _ref: new WeakRef(control),
            _notify: childNodeNotify,
            _index: 0,
            _current: EMPTY_ARR,
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
  this: BoundedInternals,
  control: BoundedInternalsChild | undefined,
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
        const notifier = control._data!._selfNotifier;

        removeFromArray(notifier._current!, notifier);

        notifier._current = EMPTY_ARR;
      }
    }
  }

  if (isLoad) {
    loadDetach(self);
  }
}

function errorAttach(
  this: ErrorControlInternals<BoundedInternals>,
  control: ErrorControlInternals<BoundedInternals> | undefined,
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
  this: ErrorControlInternals<BoundedInternals>,
  control: ErrorControlInternals<BoundedInternals> | undefined,
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

function _delete(this: Registry<any, any>, ...keys: any[]) {
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
      let bounded = self._bounded;

      for (let j = 0; j < endIndex && bounded; j++) {
        bounded = bounded.get(keyToBoundedKey(keys[j]));
      }

      if (bounded === undefined) {
        return false;
      }

      const lastKey = keyToBoundedKey(keys[endIndex]);

      const boundedControl: ControlScope | undefined = bounded.get(lastKey);

      if (boundedControl == undefined) {
        return false;
      }

      if (depth == registryDepth) {
        const boundedInternals = boundedControl[INTERNALS] as BoundedInternals;

        const notifiers = boundedInternals._notifiers;

        cleanupPrevTarget(boundedInternals);

        for (let i = 0, l = notifiers.length; i < l; i++) {
          const notifier = notifiers[i];

          removeFromArray(notifier._current!, notifier);
        }
      }

      return bounded.delete(lastKey);
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

  (this as Mutable<typeof this>)._bounded = undefined;
}

function _invalidate(this: Registry<any, any>, ...keys: PrimitiveOrNested[]) {
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

const attachNotifierWithoutCurrentChange = (
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
      (control = self._createControl(self._arg1, self._externalStorage, keys))
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

  let bounded = self._bounded;

  if (bounded === undefined) {
    self._bounded = bounded = new WeakMap();
  }

  for (let i = 0; ; i++) {
    const item = keys[i];

    if (item === undefined) {
      throwUndefinedError();
    }

    const nextBounded: typeof bounded = bounded.get(keyToBoundedKey(item));

    if (nextBounded) {
      if (i == endIndex) {
        return nextBounded;
      }

      bounded = nextBounded;
    } else {
      const loadableDependencies: ControlInternals[] = [];

      const seenLoadableRoots = new Set<ControlInternals>();

      const notifiers: Notifier[] = [];

      let errors: any[] | undefined;

      let isError = false;

      let maxLevel = 0;

      let storage = self._storage;

      let isControlExist = true;

      let isReady = true;

      const boundedInternals: BoundedInternals = {
        _load: undefined,
        _children: undefined,
        _dependents: EMPTY_ARR,
        _enqueueSet: enqueueBoundedSet,
        _get: readRootValue,
        _indexMap: undefined,
        _keys: keys,
        _value: undefined,
        _level: 0,
        _listeners: EMPTY_ARR,
        _path: undefined,
        _registry: self,
        _storage: undefined,
        _target: undefined,
        _root: undefined!,
        _attach: attach,
        _detach: detach,
        _activeCount: 0,
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

      const weakRef = new WeakRef(boundedInternals);

      const rootNotifier: Notifier = {
        _ref: weakRef,
        _notify: addToQueue,
        _index: 0,
        _current: EMPTY_ARR,
      };

      (boundedInternals as Mutable<BoundedInternals>)._selfNotifier =
        rootNotifier;

      (boundedInternals as Mutable<BoundedInternals>)._root = boundedInternals;

      for (let j = 0; ; j++) {
        let keyValue;

        const item = keys[j];

        const internals: ControlInternalsChild | undefined =
          item && item[INTERNALS];

        if (internals) {
          const root = internals._root;

          const errorControl = (root as BoundedInternals)._errorControl;

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
              _current: EMPTY_ARR,
            };

            if (errors === undefined) {
              (boundedInternals as Mutable<BoundedInternals>)._errors = errors =
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
            _current: EMPTY_ARR,
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

        if (j >= i) {
          if (j == endIndex) {
            let controlType = self._type;

            let targetInternals:
              | ControlInternals
              | AsyncControlInternals
              | undefined;

            (boundedInternals as Mutable<BoundedInternals>)._level = ++maxLevel;

            if (isReady) {
              let control:
                | ControlScope
                | Control
                | AsyncControlScope
                | undefined = isControlExist
                ? storage.get(storageKey)
                : undefined;

              if (!control) {
                storage.set(
                  storageKey,
                  (control = self._createControl(
                    self._arg1,
                    self._externalStorage,
                    keys
                  ))
                );
              }

              targetInternals = control![INTERNALS] as ControlInternals;

              if (controlType == ControlType.UNDEFINED) {
                self._type = controlType = getControlType(targetInternals);
              }

              boundedInternals._value = targetInternals._value;

              boundedInternals._target = targetInternals;

              attachNotifierWithoutCurrentChange(targetInternals, rootNotifier);
            } else if (controlType == ControlType.UNDEFINED) {
              self._type = controlType = getControlType(
                self._createControl(self._arg1, undefined, undefined)[
                  INTERNALS
                ] as ControlInternals
              );
            }

            let isLoadable = false;

            if (loadableDependencies.length) {
              (boundedInternals as Mutable<BoundedInternals>)._load =
                loadableDependencies;

              isLoadable = true;
            } else if (controlType == ControlType.LOADABLE) {
              (boundedInternals as Mutable<BoundedInternals>)._load = EMPTY_ARR;

              isLoadable = true;
            }

            if (controlType != ControlType.SYNC || errors) {
              let loadingValue = true;

              let readyValue: undefined | true;

              if (errors === undefined) {
                (boundedInternals as Mutable<BoundedInternals>)._errors =
                  errors = Array(depth + 1);
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

                  attachNotifierWithoutCurrentChange(
                    errorInternals,
                    rootNotifier
                  );
                } else {
                  loadingValue = boundedInternals._value === undefined;

                  readyValue = !loadingValue || undefined;
                }
              }

              const errorInternals: ErrorControlInternals<BoundedInternals> = {
                _root: undefined!,
                _attach: errorAttach,
                _detach: errorDetach,
                _dependents: EMPTY_ARR,
                _enqueueSet: enqueueBoundedErrorSet,
                _get: readRootValue,
                _indexMap: undefined,
                _level: maxLevel,
                _listeners: EMPTY_ARR,
                _load: isLoadable,
                _parent: boundedInternals,
                _path: undefined,
                _value: isError
                  ? new AggregateControlError(errors!)
                  : undefined,
              };

              (errorInternals as Mutable<typeof errorInternals>)._root =
                errorInternals;

              (boundedInternals as Mutable<BoundedInternals>)._loadingControl =
                {
                  [INTERNALS]: makeStatusInternals(
                    boundedInternals,
                    loadingValue
                  ),
                };

              (boundedInternals as Mutable<BoundedInternals>)._readyControl = {
                [INTERNALS]: makeStatusInternals(boundedInternals, readyValue),
              };

              (boundedInternals as Mutable<BoundedInternals>)._errorControl = {
                [INTERNALS]: errorInternals,
              };
            }

            const boundedControl = createScope(boundedInternals);

            bounded.set(internals || getToken(storageKey), boundedControl);

            return boundedControl;
          }

          bounded.set(
            internals || getToken(storageKey),
            (bounded = new WeakMap())
          );
        }

        if (isReady) {
          if (isControlExist) {
            const nextStorage = storage.get(storageKey);

            if (nextStorage) {
              storage = nextStorage;
            } else {
              isControlExist = false;

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
   * control changes. `invalidate(...keys)` resets all items under the given
   * key prefix.
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
    registryOptions?: RegistryOptions<T | undefined>
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
    registryOptions?: RegistryOptions<T>
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
    registryOptions?: RegistryOptions<T>
  ): Registry<Control<T>, Keys>;
} = (createControl: any, arg1?: unknown, options?: RegistryOptions): any =>
  ({
    _storage: new Map(),
    _bounded: undefined,
    delete: _delete,
    get,
    bind,
    invalidate: _invalidate,
    clear,
    _createControl: createControl,
    _arg1: arg1,
    _externalStorage: options && options.externalStorage,
    _type: ControlType.UNDEFINED,
    _depth: 0,
    _keepPrev: (options && options.keepPrev) || false,
    _suppressError: (options && options.suppressError) || false,
  }) as Registry<any, any[]>;

export default createRegistry;
