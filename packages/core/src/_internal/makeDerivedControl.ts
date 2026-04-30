import identity from 'lodash.identity';
import { INTERNALS } from '#shared-internal/constants';
import { EMPTY_ARR } from '#internal/constants';
import createScope from '#internal/createScope';
import readRootValue from '#internal/readRootValue';
import type {
  AsyncControlInternals,
  ChildControlNode,
  Mutable,
  ControlInternals,
  Notifier,
  Lane,
  PatchTreeNode,
  Listeners,
  ChangeListener,
} from '#internal/types';
import addToLevel from '#internal/addToLevel';
import {
  commitNextValue,
  commitPatchNode,
  UNCHANGED,
} from '#internal/commitPatchNode';
import notify from '#internal/notify';
import runPatching from '#internal/runPatching';
import { addListener, removeListener } from './flushQueue';
import { attach, detach } from './syncLifecycle';
import attachNotifier from './attachNotifier';

type DerivedControlInternals = ControlInternals & {
  readonly _load:
    | ReadonlyArray<ControlInternals>
    | ControlInternals
    | undefined;
  _mapper(...args: any[]): any;
  _keys: any;
  _rewritten: boolean;
  readonly _isSingleDependency: boolean;
};

function attachSingleLoad(
  this: DerivedControlInternals,
  control: Listeners<ChangeListener>,
  listener: ChangeListener,
  isLoad: boolean
) {
  addListener(control, listener);

  (this._load as ControlInternals)._attach(undefined, undefined, isLoad);
}

function detachSingleLoad(
  this: DerivedControlInternals,
  control: Listeners<ChangeListener>,
  listener: ChangeListener,
  isLoad: boolean
) {
  removeListener(control, listener);

  (this._load as ControlInternals)._attach(undefined, undefined, isLoad);
}

function attachMultipleLoads(
  this: DerivedControlInternals,
  control: Listeners<ChangeListener>,
  listener: ChangeListener,
  isLoad: boolean
) {
  const loadableDependencies = this._load as ReadonlyArray<ControlInternals>;

  addListener(control, listener);

  for (let i = 0; i < loadableDependencies.length; i++) {
    loadableDependencies[i]._attach(undefined, undefined, isLoad);
  }
}

function detachMultipleLoads(
  this: DerivedControlInternals,
  control: Listeners<ChangeListener>,
  listener: ChangeListener,
  isLoad: boolean
) {
  const loadableDependencies = this._load as ReadonlyArray<ControlInternals>;

  removeListener(control, listener);

  for (let i = 0; i < loadableDependencies.length; i++) {
    loadableDependencies[i]._detach(undefined, undefined, isLoad);
  }
}

function keyNotify(
  this: Notifier,
  lane: Lane,
  root: DerivedControlInternals,
  value: any,
  _: any
) {
  if (root._isSingleDependency) {
    root._keys = value;
  } else {
    root._keys[this._index] = value;
  }

  root._rewritten = true;

  const { _patchByControl } = lane;

  if (!_patchByControl.has(root)) {
    addToLevel(lane, root);

    _patchByControl.set(root, null!);
  }
}

function commitSet(
  this: DerivedControlInternals,
  patchNode: PatchTreeNode,
  lane: Lane
) {
  const root = this;

  const prevValue = root._value;

  const nextValue = root._rewritten
    ? commitNextValue(
        root._isSingleDependency
          ? root._mapper(root._keys)
          : root._mapper(...root._keys),
        prevValue,
        root,
        lane
      )
    : commitPatchNode(patchNode, prevValue, root, lane);

  root._rewritten = false;

  if (root._isSingleDependency) {
    root._keys = undefined;
  }

  if (nextValue !== UNCHANGED) {
    root._value = nextValue;

    notify(root._listeners, root._dependents, lane, nextValue, prevValue);
  }
}

function enqueueSet(
  this: DerivedControlInternals,
  value: any,
  lane: Lane,
  path: string[] | undefined
) {
  if (!this._rewritten) {
    runPatching(lane, this, value, path);
  }
}

const makeDerivedControl = (params: any[]) => {
  const controlCount = params.length - 1;

  const derivedRoot: DerivedControlInternals = {
    [INTERNALS]: undefined!,
    _get: readRootValue,
    _listeners: EMPTY_ARR,
    _indexMap: undefined,
    _dependents: EMPTY_ARR,
    _path: undefined,
    _children: undefined,
    _storage: undefined,
    _commitSet: commitSet,
    _enqueueSet: enqueueSet,
    _level: 0,
    _value: undefined,
    _attach: attach,
    _detach: detach,
    _load: undefined,
    _mapper: identity,
    _keys: undefined,
    _isSingleDependency: controlCount < 2,
    _rewritten: false,
  };

  const weakRef = new WeakRef(derivedRoot);

  if (controlCount > 1) {
    const seenLoadableRoots = new Set<ControlInternals>();

    const loadableRoots: Array<ControlInternals> = [];

    const values = Array(controlCount);

    let level = 0;

    for (let i = 0; i < controlCount; i++) {
      const internals: ChildControlNode<
        ControlInternals | AsyncControlInternals
      > = params[i][INTERNALS];

      const root = internals[INTERNALS];

      if (root._level > level) {
        level = root._level;
      }

      if (root._load && !seenLoadableRoots.has(root)) {
        seenLoadableRoots.add(root);

        loadableRoots.push(root);
      }

      attachNotifier(internals, {
        _ref: weakRef,
        _notify: keyNotify,
        _index: i,
        _current: EMPTY_ARR,
      });

      values[i] = internals._get();
    }

    const combine: (...values: any[]) => any = params[controlCount];

    const loaderCount = loadableRoots.length;

    derivedRoot._mapper = combine;

    derivedRoot._value = combine(...values);

    (derivedRoot as Mutable<typeof derivedRoot>)._level = level + 1;

    derivedRoot._keys = values;

    if (loaderCount) {
      if (loaderCount == 1) {
        (derivedRoot as Mutable<typeof derivedRoot>)._load = loadableRoots[0];

        derivedRoot._attach = attachSingleLoad;

        derivedRoot._detach = detachSingleLoad;
      } else {
        (derivedRoot as Mutable<typeof derivedRoot>)._load = loadableRoots;

        derivedRoot._attach = attachMultipleLoads;

        derivedRoot._detach = detachMultipleLoads;
      }
    }
  } else {
    const internals: ChildControlNode<
      ControlInternals | AsyncControlInternals
    > = params[0][INTERNALS];

    if (controlCount) {
      const mapper = params[1];

      derivedRoot._mapper = mapper;

      derivedRoot._value = mapper(internals._get());
    } else {
      derivedRoot._value = internals._get();
    }

    const root = internals[INTERNALS];

    (derivedRoot as Mutable<typeof derivedRoot>)._level = root._level + 1;

    if (root._load) {
      (derivedRoot as Mutable<typeof derivedRoot>)._load = root;

      derivedRoot._attach = attachSingleLoad;

      derivedRoot._detach = detachSingleLoad;
    }

    attachNotifier(internals, {
      _ref: weakRef,
      _notify: keyNotify,
      _index: 0,
      _current: EMPTY_ARR,
    });
  }

  (derivedRoot as Mutable<typeof derivedRoot>)[INTERNALS] = derivedRoot;

  return createScope(derivedRoot);
};

export default makeDerivedControl;
