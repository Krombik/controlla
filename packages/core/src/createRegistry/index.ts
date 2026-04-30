import toKey, { type PrimitiveOrNested } from 'keyweaver';
import type {
  Registry,
  AsyncControlOptions,
  AsyncControlScope,
  ControlScope,
  SyncExternalStorage,
  AsyncControl,
} from '#types';
import {
  ControlType,
  type ErrorControlInternals,
  type AsyncControlInternals,
  type AsyncThings,
  type ChangeListener,
  type ChildControlNode,
  type ControlInternals,
  type ControlInternalsChild,
  type Lane,
  type Mutable,
  type Notifier,
  type WithInitModule,
} from '#internal/types';
import type createControl from '#@/createControl';
import type createAsyncControl from '#@/createAsyncControl';
import { INTERNALS } from '#shared-internal/constants';
import invalidate from '#@/invalidate';
import createScope from '#internal/createScope';
import readRootValue from '#internal/readRootValue';
import { EMPTY_ARR } from '#internal/constants';
import append from '#shared-internal/append';
import { addListener, removeListener } from '#internal/flushQueue';
import addToLevel from '#internal/addToLevel';
import { commitNextValue, UNCHANGED } from '#internal/commitPatchNode';
import notify from '#internal/notify';
import removeFromArray from '#internal/removeFromArray';
import attachNotifier from '#internal/attachNotifier';

interface BoundedInternals
  extends ControlInternals, Partial<AsyncThings<BoundedInternals>> {
  _activeCount: number;
  _target: ControlInternals | undefined;
  readonly _activeNodes: BoundedInternalsChild[];
  readonly _changedNodes: BoundedInternalsChild[];
  readonly _notifiers: Notifier[];
  readonly _selfNotifier: Notifier;
  readonly _errorNotifier: Notifier | undefined;
  _keys: any[];
  readonly _load: ReadonlyArray<ControlInternals> | undefined;
  readonly _registry: Registry<any, any>;
}

type BoundedInternalsChild = ChildControlNode<BoundedInternals>;

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
  path: undefined
) {
  const target = this._parent._target;

  if (target) {
    (target as AsyncControlInternals)._errorControl[INTERNALS]._enqueueSet(
      value,
      lane,
      path
    );
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

const rootNodeNotify = (
  lane: Lane,
  root: BoundedInternals,
  value: any,
  _: any
) => {
  const patchByControl = lane._patchByControl;

  if (!patchByControl.has(root)) {
    addToLevel(lane, root);
  }

  patchByControl.set(root, value);
};

function keyChangeNotify(
  this: Notifier,
  lane: Lane,
  root: BoundedInternals,
  value: any,
  _: any
) {
  const patchByControl = lane._patchByControl;

  const prevTarget = root._target;

  root._keys[this._index] = value;

  if (prevTarget !== undefined) {
    const activeNodes = root._activeNodes;

    const notifier = root._selfNotifier;

    const errorNotifier = root._errorNotifier;

    const prevLoad = prevTarget._load as AsyncControlInternals['_load'];

    root._target = undefined;

    removeFromArray(notifier._current, notifier);

    notifier._current = EMPTY_ARR;

    if (errorNotifier) {
      const errorInternals = root._errorControl![INTERNALS];

      if (patchByControl.has(errorInternals)) {
        patchByControl.set(errorInternals, UNCHANGED);
      }

      removeFromArray(errorNotifier._current, errorNotifier);

      errorNotifier._current = EMPTY_ARR;
    }

    for (let i = 0, l = activeNodes.length; i < l; i++) {
      const notifier = activeNodes[i]._data!._selfNotifier;

      removeFromArray(notifier._current, notifier);

      notifier._current = EMPTY_ARR;
    }

    if (prevLoad && root._activeCount) {
      prevLoad._activeCount -= root._activeCount - 1;

      prevTarget._detach(undefined, undefined, true);
    }

    if (root._changedNodes.length) {
      root._changedNodes.length = 0;
    }
  }

  if (!patchByControl.has(root)) {
    addToLevel(lane, root);

    patchByControl.set(root, null);
  }
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
    let control: ControlScope = nextStorage && storage.get(key);

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

function commitSet(this: BoundedInternals, value: any, lane: Lane) {
  const root = this;

  const prevValue = root._value;

  if (root._target) {
    const changedNodes = root._changedNodes;

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

    if (value !== undefined && root._promise) {
      root._promise._resolve(value);

      root._promise = undefined;
    }
  } else {
    const activeNodes = root._activeNodes;

    const registry = root._registry;

    const nextTarget = getNextTarget(registry, root._keys);

    if (nextTarget) {
      const nextLoad = nextTarget._load as AsyncControlInternals['_load'];

      attachNotifier(nextTarget, root._selfNotifier);

      for (let i = 0, l = activeNodes.length; i < l; i++) {
        const node = activeNodes[i];

        attachNotifierToTargetNode(
          nextTarget,
          node._path!,
          node._data!._selfNotifier
        );
      }

      if (nextLoad && root._activeCount) {
        nextTarget._attach(undefined, undefined, true);

        nextLoad._activeCount += root._activeCount - 1;
      }

      root._target = nextTarget;
    }

    const value = nextTarget && nextTarget._value;

    const nextValue = commitNextValue(value, prevValue, root, lane);

    if (nextValue !== UNCHANGED) {
      root._value = nextValue;

      notify(root._listeners, root._dependents, lane, nextValue, prevValue);

      if (nextValue !== undefined && root._promise) {
        root._promise._resolve(nextValue);

        root._promise = undefined;
      }
    }

    if (registry._type != ControlType.SYNC) {
      const errorInternals = root._errorControl![INTERNALS];

      const loadingInternals = root._loadingControl![INTERNALS];

      const readyInternals = root._readyControl![INTERNALS];

      const prevLoading = loadingInternals._value;

      const prevReady = readyInternals._value;

      const prevError = errorInternals._value;

      let nextLoadingValue = true;

      let nextReadyValue: undefined | true;

      let nextErrorValue: any;

      if (nextTarget) {
        const nextTargetErrorInternals = (nextTarget as AsyncControlInternals)
          ._errorControl[INTERNALS];

        attachNotifier(nextTargetErrorInternals, root._errorNotifier!);

        nextErrorValue = nextTargetErrorInternals._value;

        nextLoadingValue = (nextTarget as AsyncControlInternals)
          ._loadingControl[INTERNALS]._value;

        nextReadyValue = (nextTarget as AsyncControlInternals)._readyControl[
          INTERNALS
        ]._value;
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

        if (nextErrorValue !== undefined && root._promise) {
          root._promise._reject(nextErrorValue);

          root._promise = undefined;
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
}

function commitErrorSet(
  this: ErrorControlInternals<BoundedInternals>,
  value: any,
  lane: Lane
) {
  if (value !== UNCHANGED) {
    const root = this;

    const parent = root._parent;

    const prevValue = root._value;

    root._value = value;

    notify(root._listeners, root._dependents, lane, value, prevValue);

    if (value !== undefined && parent._promise) {
      parent._promise._reject(value);

      parent._promise = undefined;
    }
  }
}

const attachNotifierToTargetNode = (
  root: ControlInternals,
  path: readonly string[],
  notifier: Notifier
) => {
  const l = path.length;

  let children = root._children;

  let target: ControlInternalsChild = root;

  for (let i = 0; i < l; i++) {
    let key = path[i];

    const nextTarget = children && children.get(key);

    if (nextTarget === undefined) {
      let prevPath: readonly string[];

      const endIndex = path.length - 1;

      if (children === undefined) {
        target._children = children = new Map();
      }

      if (i) {
        prevPath = target._path!;
      } else if (endIndex) {
        children.set(key, {
          _get: get,
          _listeners: EMPTY_ARR,
          _indexMap: undefined,
          _dependents: EMPTY_ARR,
          _path: (prevPath = [key]),
          [INTERNALS]: root,
          _children: (children = new Map()),
          _storage: undefined,
          _data: undefined,
        });

        key = path[++i];
      }

      while (i != endIndex) {
        children.set(key, {
          _get: get,
          _listeners: EMPTY_ARR,
          _indexMap: undefined,
          _dependents: EMPTY_ARR,
          _path: (prevPath = append(prevPath!, key)),
          [INTERNALS]: root,
          _children: (children = new Map()),
          _storage: undefined,
          _data: undefined,
        });

        key = path[++i];
      }

      children.set(key, {
        _get: get,
        _listeners: EMPTY_ARR,
        _indexMap: undefined,
        _dependents: (notifier._current = [notifier]),
        _path: path,
        [INTERNALS]: root,
        _children: undefined,
        _storage: undefined,
        _data: undefined,
      });

      return;
    }

    target = nextTarget;

    children = target._children;
  }

  attachNotifier(target, notifier);
};

function attach(
  this: BoundedInternals,
  control: BoundedInternalsChild | undefined,
  listener: ChangeListener | undefined,
  isLoad: boolean
) {
  const self = this;

  const target = self._target;

  if (control) {
    if (control._path !== undefined && !control._listeners.length) {
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
    const load = self._load;

    self._activeCount++;

    if (load) {
      for (let i = 0, l = load.length; i < l; i++) {
        load[i]._attach(undefined, undefined, true);
      }
    }

    if (target) {
      target._attach(undefined, undefined, true);
    }
  }
}

function detach(
  this: BoundedInternals,
  control: BoundedInternalsChild | undefined,
  listener: ChangeListener | undefined,
  isLoad: boolean
) {
  const self = this;

  const target = self._target;

  if (control) {
    removeListener(control, listener!);

    if (control._path !== undefined && !control._listeners.length) {
      removeFromArray(self._activeNodes, control);

      if (target) {
        const notifier = control._data!._selfNotifier;

        removeFromArray(notifier._current, notifier);

        notifier._current = EMPTY_ARR;
      }
    }
  }

  if (isLoad) {
    const load = self._load;

    self._activeCount--;

    if (load) {
      for (let i = 0, l = load.length; i < l; i++) {
        load[i]._detach(undefined, undefined, true);
      }
    }

    if (target) {
      target._detach(undefined, undefined, true);
    }
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
    const parent = this._parent;

    const target = parent._target;

    const load = parent._load;

    parent._activeCount++;

    if (load) {
      for (let i = 0, l = load.length; i < l; i++) {
        load[i]._attach(undefined, undefined, true);
      }
    }

    if (target) {
      target._attach(undefined, undefined, true);
    }
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
    const parent = this._parent;

    const target = parent._target;

    const load = parent._load;

    parent._activeCount--;

    if (load) {
      for (let i = 0, l = load.length; i < l; i++) {
        load[i]._detach(undefined, undefined, true);
      }
    }

    if (target) {
      target._detach(undefined, undefined, true);
    }
  }
}

function _delete(this: Registry<any, any>, ...keys: PrimitiveOrNested[]) {
  const l = keys.length - 1;

  let storage = this._storage;

  for (let i = 0; i < l; i++) {
    const keyValue = keys[i];

    const storageKey =
      keyValue && typeof keyValue == 'object' ? toKey(keyValue) : keyValue;

    const nextStorage = storage.get(storageKey)!;

    if (!nextStorage) {
      return false;
    }

    storage = nextStorage;
  }

  const keyValue = keys[l];

  return storage.delete(
    keyValue && typeof keyValue == 'object' ? toKey(keyValue) : keyValue
  );
}

function clear(this: Registry<any, any[]>) {
  this._storage.clear();

  (this as Mutable<typeof this>)._bounded = undefined;
}

function _invalidate(this: Registry<any, any>, ...keys: PrimitiveOrNested[]) {
  const l = keys.length;

  let storage = this._storage;

  for (let i = 0; i < l; i++) {
    const keyValue = keys[i];

    const storageKey =
      keyValue && typeof keyValue == 'object' ? toKey(keyValue) : keyValue;

    const nextStorage = storage.get(storageKey)!;

    if (!nextStorage) {
      return;
    }

    storage = nextStorage;
  }

  if (storage instanceof Map) {
    const queue: Map<any, any>[] = [storage];

    do {
      const item = queue.pop()!;

      let i = item.size;

      if (i) {
        const it = item.values();

        const first: Map<any, any> | AsyncControl = it.next().value;

        if (first instanceof Map) {
          queue.push(first);

          while (--i) {
            queue.push(it.next().value);
          }
        } else {
          invalidate(first);

          while (--i) {
            invalidate(it.next().value);
          }
        }
      }
    } while (queue.length);
  } else {
    invalidate(storage);
  }
}

function has(this: Registry<any, any>, ...keys: PrimitiveOrNested[]) {
  const l = keys.length - 1;

  let storage = this._storage;

  for (let i = 0; i < l; i++) {
    const keyValue = keys[i];

    const storageKey =
      keyValue && typeof keyValue == 'object' ? toKey(keyValue) : keyValue;

    const nextStorage = storage.get(storageKey);

    if (!nextStorage) {
      return false;
    }

    storage = nextStorage;
  }

  const keyValue = keys[l];

  return storage.has(
    keyValue && typeof keyValue == 'object' ? toKey(keyValue) : keyValue
  );
}

const TOKENS_MAP = new Map<any, {}>();

const throwUndefinedError = () => {
  throw new Error('Undefined cannot be used as a registry key.');
};

function get(this: Registry<any, any>, ...keys: any[]): any {
  const endIndex = keys.length - 1;

  const self = this;

  let storage = self._storage;

  let keyValue: any;

  let nextStorage: Map<any, any> | undefined = storage;

  for (let i = 0; true; i++) {
    keyValue = keys[i];

    if (keyValue === undefined) {
      throwUndefinedError();
    }

    const firstInternals: ControlInternals | undefined =
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
        const keyValue = keys[j];

        const storageKey =
          keyValue && typeof keyValue == 'object' ? toKey(keyValue) : keyValue;

        let token = TOKENS_MAP.get(storageKey);

        if (!token) {
          nextBounded = undefined;

          TOKENS_MAP.set(storageKey, (token = {}));
        }

        nextBounded = nextBounded && bounded.get(token);

        if (nextBounded) {
          bounded = nextBounded;
        } else {
          bounded.set(token, (bounded = new WeakMap()));
        }
      }

      nextBounded = nextBounded && bounded.get(firstInternals);

      for (let internals = firstInternals; nextBounded; ) {
        if (existedIndex == endIndex) {
          return nextBounded;
        }

        bounded = nextBounded;

        keyValue = keys[++existedIndex];

        internals = keyValue && keyValue[INTERNALS];

        if (internals) {
          nextBounded = bounded.get(internals);
        } else {
          const token = TOKENS_MAP.get(
            keyValue && typeof keyValue == 'object' ? toKey(keyValue) : keyValue
          );

          nextBounded = token && bounded.get(token);
        }
      }

      const loadableDependencies: ControlInternals[] = [];

      let isReady = true;

      let maxLevel = 0;

      const notifiers: Notifier[] = [];

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
        _errorNotifier: undefined,
        _errorControl: undefined,
        _loadingControl: undefined,
        _promise: undefined,
        _readyControl: undefined,
      };

      const weakRef = new WeakRef(boundedInternals);

      const rootNotifier: Notifier = {
        _ref: weakRef,
        _notify: rootNodeNotify,
        _index: 0,
        _current: EMPTY_ARR,
      };

      (boundedInternals as Mutable<BoundedInternals>)._selfNotifier =
        rootNotifier;

      for (let j = i, internals = firstInternals; true; ) {
        if (internals) {
          keys[j] = keyValue = internals._get();

          if (isReady && keyValue === undefined) {
            isReady = false;
          }

          const notifier: Notifier = {
            _ref: weakRef,
            _notify: keyChangeNotify,
            _index: j,
            _current: EMPTY_ARR,
          };

          attachNotifier(internals, notifier);

          notifiers.push(notifier);

          if (internals._load) {
            loadableDependencies.push(internals);
          }

          if (internals._level > maxLevel) {
            maxLevel = internals._level;
          }
        } else if (keyValue === undefined) {
          throwUndefinedError();
        }

        const storageKey =
          keyValue && typeof keyValue == 'object' ? toKey(keyValue) : keyValue;

        if (j == endIndex) {
          let control: ControlScope | undefined;

          let controlType = self._type;

          let targetInternals:
            | ControlInternals
            | AsyncControlInternals
            | undefined;

          (boundedInternals as Mutable<BoundedInternals>)._level = ++maxLevel;

          if (isReady) {
            control = nextStorage && storage.get(storageKey);

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
          }

          if (isReady) {
            targetInternals = control![INTERNALS] as ControlInternals;

            if (controlType == ControlType.UNDEFINED) {
              self._type = controlType = targetInternals._load
                ? ControlType.LOADABLE
                : '_errorControl' in targetInternals
                  ? ControlType.ASYNC
                  : ControlType.SYNC;
            }

            boundedInternals._value = targetInternals._value;

            boundedInternals._target = targetInternals;

            attachNotifier(targetInternals, rootNotifier);
          } else if (controlType == ControlType.UNDEFINED) {
            const internals = self._getItem(self._arg1, undefined, undefined)[
              INTERNALS
            ];

            self._type = controlType = internals._load
              ? ControlType.LOADABLE
              : '_errorControl' in internals
                ? ControlType.ASYNC
                : ControlType.SYNC;
          }

          if (loadableDependencies.length) {
            (boundedInternals as Mutable<BoundedInternals>)._load =
              loadableDependencies;
          } else if (controlType == ControlType.LOADABLE) {
            (boundedInternals as Mutable<BoundedInternals>)._load = EMPTY_ARR;
          }

          if (controlType != ControlType.SYNC) {
            const targetErrorInternals =
              targetInternals &&
              (targetInternals as AsyncControlInternals)._errorControl[
                INTERNALS
              ];

            const errorInternals: ErrorControlInternals<BoundedInternals> = {
              [INTERNALS]: undefined!,
              _attach: errorAttach,
              _detach: errorDetach,
              _commitSet: commitErrorSet,
              _dependents: EMPTY_ARR,
              _enqueueSet: enqueueBoundedErrorSet,
              _get: readRootValue,
              _indexMap: undefined,
              _level: maxLevel,
              _listeners: EMPTY_ARR,
              _load: controlType == ControlType.LOADABLE,
              _parent: boundedInternals,
              _path: undefined,
              _value: targetErrorInternals && targetErrorInternals._value,
            };

            const errorNotifier: Notifier = {
              _ref: new WeakRef(errorInternals),
              _notify: rootNodeNotify,
              _index: 0,
              _current: EMPTY_ARR,
            };

            (boundedInternals as Mutable<BoundedInternals>)._errorNotifier =
              errorNotifier;

            if (targetErrorInternals) {
              attachNotifier(targetErrorInternals, errorNotifier);
            }

            (errorInternals as Mutable<typeof errorInternals>)[INTERNALS] =
              errorInternals;

            (boundedInternals as Mutable<BoundedInternals>)._loadingControl = {
              [INTERNALS]: {
                [INTERNALS]: boundedInternals,
                _dependents: EMPTY_ARR,
                _get: readRootValue,
                _indexMap: undefined,
                _level: maxLevel,
                _listeners: EMPTY_ARR,
                _load: true,
                _path: undefined,
                _value: targetInternals
                  ? (targetInternals as AsyncControlInternals)._loadingControl[
                      INTERNALS
                    ]._value
                  : true,
              },
            };

            (boundedInternals as Mutable<BoundedInternals>)._readyControl = {
              [INTERNALS]: {
                [INTERNALS]: boundedInternals,
                _dependents: EMPTY_ARR,
                _get: readRootValue,
                _indexMap: undefined,
                _level: maxLevel,
                _listeners: EMPTY_ARR,
                _load: true,
                _path: undefined,
                _value: targetInternals
                  ? (targetInternals as AsyncControlInternals)._readyControl[
                      INTERNALS
                    ]._value
                  : undefined,
              },
            };

            (boundedInternals as Mutable<BoundedInternals>)._errorControl = {
              [INTERNALS]: errorInternals,
            };
          }

          const boundedControl = createScope(boundedInternals);

          if (internals) {
            bounded.set(internals, boundedControl);
          } else {
            let token = TOKENS_MAP.get(storageKey);

            if (!token) {
              TOKENS_MAP.set(storageKey, (token = {}));
            }

            bounded.set(token, boundedControl);
          }

          return boundedControl;
        }

        if (j >= existedIndex) {
          if (internals) {
            bounded.set(internals, (bounded = new WeakMap()));
          } else {
            let token = TOKENS_MAP.get(storageKey);

            if (!token) {
              TOKENS_MAP.set(storageKey, (token = {}));
            }

            bounded.set(token, (bounded = new WeakMap()));
          }
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

        internals = keyValue && keyValue[INTERNALS];
      }
    }

    const storageKey =
      keyValue && typeof keyValue == 'object' ? toKey(keyValue) : keyValue;

    if (i == endIndex) {
      let control = nextStorage && storage.get(storageKey);

      if (!control) {
        storage.set(
          storageKey,
          (control = self._getItem(self._arg1, self._syncExternalStorage, keys))
        );

        if (self._type == ControlType.UNDEFINED) {
          const internals: ControlInternals | AsyncControlInternals =
            control[INTERNALS];

          self._type = internals._load
            ? ControlType.LOADABLE
            : '_errorControl' in internals
              ? ControlType.ASYNC
              : ControlType.SYNC;
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
  <T, Keys extends PrimitiveOrNested[], E = any>(
    ...args: WithInitModule<
      T | undefined,
      [
        createAsyncControl: typeof createAsyncControl,
        options?: AsyncControlOptions<T, Keys, E>,
      ]
    >
  ): Registry<AsyncControlScope<T, E>, Keys>;

  <T, Keys extends PrimitiveOrNested[]>(
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
  }) as Registry<any, any[]>;

export default createRegistry;
