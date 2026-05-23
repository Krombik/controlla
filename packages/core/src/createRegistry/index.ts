import { type PrimitiveOrNested } from 'keyweaver';
import type {
  Registry,
  AsyncControlOptions,
  AsyncControlScope,
  ControlScope,
  SyncExternalStorage,
  Control,
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
  WithInitModule,
  ControlInternalsBase,
} from '#internal/types';
import createControl from '#@/createControl';
import createAsyncControl from '#@/createAsyncControl';
import { INTERNALS } from '#shared-internal/constants';
import invalidate from '#@/invalidate';
import createScope from '#internal/createScope';
import readRootValue from '#internal/readRootValue';
import { ControlType, EMPTY_ARR } from '#internal/constants';
import append from '#shared-internal/append';
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
import throwReadonlyError from '#internal/throwReadonlyError';

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

const childNodeNotify = (
  _: Lane,
  node: BoundedInternalsChild,
  value: any,
  prevValue: any
) => {
  const data = node._data!;

  data._value = value;

  data._prevValue = prevValue;

  node[INTERNALS]._changedNodes.push(node);
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
        (control = registry._getItem(
          registry._arg1,
          registry._syncExternalStorage,
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

  if (registry._type != ControlType.SYNC || errors) {
    const errorInternals = root._errorControl![INTERNALS];

    const loadingInternals = root._loadingControl![INTERNALS];

    const readyInternals = root._readyControl![INTERNALS];

    const prevLoading = loadingInternals._value;

    const prevReady = readyInternals._value;

    const prevError = errorInternals._value;

    let nextLoadingValue = true;

    let nextReadyValue: undefined | true;

    let nextErrorValue: any;

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

        if (errorValue !== undefined) {
          if (errors === undefined) {
            nextErrorValue = errorValue;
          } else if (errorValue !== errors[registry._depth]) {
            errors[registry._depth] = errorValue;

            nextErrorValue = errors.slice();
          } else {
            nextErrorValue = prevError;
          }
        } else if (errors && errors[registry._depth] !== undefined) {
          errors[registry._depth] = errorValue;
        }

        nextLoadingValue = currentTarget._loadingControl[INTERNALS]._value;

        nextReadyValue = currentTarget._readyControl[INTERNALS]._value;
      } else {
        nextLoadingValue = root._value === undefined;

        nextReadyValue = !nextLoadingValue || undefined;
      }
    } else if (errors) {
      for (let i = 0, l = errors.length; i < l; i++) {
        if (errors[i] !== undefined) {
          nextErrorValue = errors.slice();

          break;
        }
      }
    }

    if (prevError !== nextErrorValue) {
      errorInternals._value = nextErrorValue;

      notify(
        errorInternals._listeners,
        errorInternals._dependents,
        lane,
        nextErrorValue,
        prevError
      );

      if (nextErrorValue !== undefined) {
        settlePromise(root, false, nextErrorValue);
      }
    }

    if (nextLoadingValue != prevLoading) {
      loadingInternals._value = nextLoadingValue;

      notify(
        loadingInternals._listeners,
        loadingInternals._dependents,
        lane,
        nextLoadingValue,
        prevLoading
      );
    }

    if (nextReadyValue != prevReady) {
      readyInternals._value = nextReadyValue;

      notify(
        readyInternals._listeners,
        readyInternals._dependents,
        lane,
        nextReadyValue,
        prevReady
      );
    }
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

const walkBoundedPrefix = (
  bounded: WeakMap<any, any> | undefined,
  keys: any[],
  end: number
) => {
  for (let i = 0; i < end && bounded; i++) {
    bounded = bounded.get(getToken(getStorageKey(keys[i])));
  }

  return bounded;
};

const walkBoundedSuffix = (
  bounded: WeakMap<any, any> | undefined,
  keys: any[],
  i: number,
  end: number
) => {
  while (bounded && ++i < end) {
    bounded = bounded.get(keyToBoundedKey(keys[i]));
  }

  return bounded;
};

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

    const firstInternals = keyValue && keyValue[INTERNALS];

    if (firstInternals) {
      let bounded = walkBoundedPrefix(self._bounded, keys, i);

      if (bounded === undefined) {
        return false;
      }

      let boundedControl: ControlScope | undefined;

      let lastKey;

      if (i == endIndex) {
        lastKey = firstInternals;

        boundedControl = bounded.get(firstInternals);
      } else {
        bounded = walkBoundedSuffix(
          bounded.get(firstInternals),
          keys,
          i,
          endIndex
        );

        if (bounded === undefined) {
          return false;
        }

        lastKey = keyToBoundedKey(keys[endIndex]);

        boundedControl = bounded.get(lastKey);
      }

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

function has(this: Registry<any, any>, ...keys: any[]) {
  const self = this;

  const endIndex = keys.length - 1;

  let storage = self._storage;

  for (let i = 0; true; i++) {
    const keyValue = keys[i];

    if (keyValue === undefined) {
      throwUndefinedError();
    }

    const firstInternals = keyValue && keyValue[INTERNALS];

    if (firstInternals) {
      let bounded = walkBoundedPrefix(self._bounded, keys, i);

      if (bounded === undefined) {
        return false;
      }

      if (i == endIndex) {
        return bounded.has(firstInternals);
      }

      bounded = walkBoundedSuffix(
        bounded.get(firstInternals),
        keys,
        i,
        endIndex
      );

      if (bounded === undefined) {
        return false;
      }

      return bounded.has(keyToBoundedKey(keys[endIndex]));
    }

    if (i == endIndex) {
      return storage.has(getStorageKey(keyValue));
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
      const diff = registryDepth - depth - 1;

      if (diff) {
        let queue: Map<any, any>[] = [storage];

        for (let i = 0; i < diff; i++) {
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
      } else {
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

function get(this: Registry<any, any>, ...keys: any[]): any {
  const self = this;

  const depth = keys.length;

  const registryDepth = self._depth;

  if (registryDepth != depth) {
    if (registryDepth) {
      throw new Error('inconsistent registry depth');
    }

    (self as Mutable<typeof self>)._depth = depth;
  }

  const endIndex = depth - 1;

  let storage = self._storage;

  let keyValue: any;

  let nextStorage: Map<any, any> | undefined = storage;

  for (let i = 0; true; i++) {
    keyValue = keys[i];

    if (keyValue === undefined) {
      throwUndefinedError();
    }

    const firstInternals: ControlInternalsChild | undefined =
      keyValue && keyValue[INTERNALS];

    if (firstInternals) {
      let existedIndex = i;

      let bounded = self._bounded!;

      let nextBounded: WeakMap<any, any> | undefined;

      if (!bounded) {
        (self as Mutable<typeof self>)._bounded = bounded = new WeakMap();
      } else if (nextStorage) {
        nextBounded = bounded;
      }

      for (let j = 0; j < i; j++) {
        const token = getToken(getStorageKey(keys[j]));

        nextBounded = nextBounded && bounded.get(token);

        if (nextBounded) {
          bounded = nextBounded;
        } else {
          bounded.set(token, (bounded = new WeakMap()));
        }
      }

      for (
        nextBounded = nextBounded && bounded.get(firstInternals);
        nextBounded !== undefined;
      ) {
        if (existedIndex == endIndex) {
          return nextBounded;
        }

        keyValue = keys[++existedIndex];

        bounded = nextBounded;

        nextBounded = nextBounded.get(keyToBoundedKey(keyValue));
      }

      const loadableDependencies: ControlInternals[] = [];

      const seenLoadableRoots = new Set<ControlInternals>();

      const notifiers: Notifier[] = [];

      let errors: any[] | undefined;

      let isReady = true;

      let isError = false;

      let maxLevel = 0;

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
        [INTERNALS]: undefined!,
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

      (boundedInternals as Mutable<BoundedInternals>)[INTERNALS] =
        boundedInternals;

      for (
        let j = i,
          keyInternals: ControlInternalsChild | undefined = firstInternals,
          keyRoot: ControlInternals | undefined = keyInternals[INTERNALS];
        true;
      ) {
        if (keyRoot) {
          keys[j] = keyValue = keyInternals!._get();

          if (isReady && keyValue === undefined) {
            isReady = false;
          }

          const errorControl = (keyRoot as BoundedInternals)._errorControl;

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

          attachNotifier(keyInternals!, notifier);

          notifiers.push(notifier);

          if (keyRoot._load && !seenLoadableRoots.has(keyRoot)) {
            loadableDependencies.push(keyRoot);

            seenLoadableRoots.add(keyRoot);
          }

          if (keyRoot._level > maxLevel) {
            maxLevel = keyRoot._level;
          }
        } else if (keyValue === undefined) {
          throwUndefinedError();
        }

        const storageKey = getStorageKey(keyValue);

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
              | undefined = nextStorage && storage.get(storageKey);

            if (!control) {
              storage.set(
                storageKey,
                (control = self._getItem(
                  self._arg1,
                  self._syncExternalStorage,
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
              self._getItem(self._arg1, undefined, undefined)[
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

            let errorValue: any;

            if (isReady) {
              if ('_errorControl' in targetInternals!) {
                const errorInternals = targetInternals._errorControl[INTERNALS];

                const currErrorValue = errorInternals._value;

                loadingValue =
                  targetInternals._loadingControl[INTERNALS]._value;

                readyValue = targetInternals._readyControl[INTERNALS]._value;

                if (errors === undefined) {
                  errorValue = currErrorValue;
                } else if (currErrorValue !== undefined) {
                  errors[depth] = currErrorValue;

                  errorValue = errors.slice();
                }

                attachNotifierWithoutCurrentChange(
                  errorInternals,
                  rootNotifier
                );
              } else {
                loadingValue = boundedInternals._value === undefined;

                readyValue = !loadingValue || undefined;
              }
            } else if (isError) {
              errorValue = errors!.slice();
            }

            const errorInternals: ErrorControlInternals<BoundedInternals> = {
              [INTERNALS]: undefined!,
              _attach: errorAttach,
              _detach: errorDetach,
              _dependents: EMPTY_ARR,
              _enqueueSet: throwReadonlyError,
              _get: readRootValue,
              _indexMap: undefined,
              _level: maxLevel,
              _listeners: EMPTY_ARR,
              _load: isLoadable,
              _parent: boundedInternals,
              _path: undefined,
              _value: errorValue,
            };

            (errorInternals as Mutable<typeof errorInternals>)[INTERNALS] =
              errorInternals;

            (boundedInternals as Mutable<BoundedInternals>)._loadingControl = {
              [INTERNALS]: makeStatusInternals(boundedInternals, loadingValue),
            };

            (boundedInternals as Mutable<BoundedInternals>)._readyControl = {
              [INTERNALS]: makeStatusInternals(boundedInternals, readyValue),
            };

            (boundedInternals as Mutable<BoundedInternals>)._errorControl = {
              [INTERNALS]: errorInternals,
            };
          }

          const boundedControl = createScope(boundedInternals);

          bounded.set(keyInternals || getToken(storageKey), boundedControl);

          return boundedControl;
        }

        if (j >= existedIndex) {
          bounded.set(
            keyInternals || getToken(storageKey),
            (bounded = new WeakMap())
          );
        }

        if (isReady) {
          nextStorage = nextStorage && storage.get(storageKey);

          if (nextStorage) {
            storage = nextStorage;
          } else {
            storage.set(storageKey, (storage = new Map()));
          }
        }

        keyValue = keys[++j];

        keyInternals = keyValue && keyValue[INTERNALS];

        keyRoot = keyInternals && keyInternals[INTERNALS];
      }
    }

    const storageKey = getStorageKey(keyValue);

    if (i == endIndex) {
      let control = nextStorage && storage.get(storageKey);

      if (!control) {
        storage.set(
          storageKey,
          (control = self._getItem(self._arg1, self._syncExternalStorage, keys))
        );

        if (self._type == ControlType.UNDEFINED) {
          self._type = getControlType(control[INTERNALS]);
        }
      }

      return control;
    }

    nextStorage = nextStorage && storage.get(storageKey);

    if (nextStorage) {
      storage = nextStorage;
    } else {
      storage.set(storageKey, (storage = new Map()));
    }
  }
}

const createRegistry: {
  <T, Keys extends Exclude<PrimitiveOrNested, undefined>[], E = any>(
    ...args: WithInitModule<
      T | undefined,
      [
        createAsyncControl: typeof createAsyncControl,
        options?: AsyncControlOptions<T, Keys, E>,
      ]
    >
  ): Registry<AsyncControlScope<T, E>, Keys>;

  <T, Keys extends Exclude<PrimitiveOrNested, undefined>[]>(
    ...args: WithInitModule<
      T,
      [
        createControl: typeof createControl,
        defaultValue?: T | ((keys: Keys) => T),
      ]
    >
  ): Registry<ControlScope<T>, Keys>;
} = (
  getItem: any,
  arg1?: unknown,
  syncExternalStorage?: SyncExternalStorage
): any =>
  ({
    _storage: new Map(),
    _bounded: undefined,
    delete: _delete,
    get,
    invalidate: _invalidate,
    has,
    clear,
    _getItem: getItem,
    _arg1: arg1,
    _syncExternalStorage: syncExternalStorage,
    _type: ControlType.UNDEFINED,
    _depth: 0,
  }) as Registry<any, any[]>;

export default createRegistry;
