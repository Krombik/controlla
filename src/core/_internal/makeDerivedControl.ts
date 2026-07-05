import identity from 'lodash.identity';
import { INTERNALS, EMPTY_ARR } from '#internal/constants';
import createScope from '#internal/createScope';
import readRootValue from '#internal/readRootValue';
import type {
  AsyncControlInternals,
  ChildControlNode,
  Mutable,
  ControlInternals,
  Lane,
  PatchTreeNode,
} from '#internal/types';
import {
  commitNextValue,
  commitPatchNode,
  UNCHANGED,
} from '#internal/commitPatchNode';
import { attach, detach } from '#internal/syncLifecycle';
import attachNotifier from '#internal/attachNotifier';
import {
  applyLoadWiring,
  attachSingleLoad,
  detachSingleLoad,
  enqueueSet,
  keyNotify,
  type DerivedControlInternals,
} from '#internal/derivedControlUtils';
import { notify } from '#internal/flushQueue';

function commitSet(
  this: DerivedControlInternals,
  patchNode: PatchTreeNode,
  lane: Lane
) {
  const root = this;

  const prevValue = root._value;

  let nextValue: any;

  if (root._equable) {
    nextValue = commitPatchNode(patchNode, prevValue, root, lane);
  } else {
    let next;

    root._equable = true;

    if (root._isSingleDependency) {
      next = root._mapper(root._keys);

      root._keys = undefined;
    } else {
      next = root._mapper(...root._keys);
    }

    nextValue = commitNextValue(next, prevValue, root, lane);
  }

  if (nextValue !== UNCHANGED) {
    root._value = nextValue;

    notify(root._listeners, root._dependents, lane, nextValue, prevValue);
  }
}

const makeDerivedControl = (params: any[]) => {
  let maxLevel = 0;

  const controlCount = params.length - 1;

  const derivedRoot: DerivedControlInternals = {
    _root: undefined!,
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
    _load: false,
    _mapper: identity,
    _keys: undefined,
    _isSingleDependency: controlCount < 2,
    _equable: true,
    _notifiers: undefined!,
  };

  const weakRef = new WeakRef(derivedRoot);

  if (controlCount > 1) {
    const seenLoadableRoots = new Set<ControlInternals>();

    const loadableRoots: Array<ControlInternals> = [];

    const values = Array(controlCount);

    const notifiers = Array(controlCount);

    for (let i = 0; i < controlCount; i++) {
      const internals: ChildControlNode<
        ControlInternals | AsyncControlInternals
      > = params[i][INTERNALS];

      const root = internals._root;

      if (root._level > maxLevel) {
        maxLevel = root._level;
      }

      if (root._load && !seenLoadableRoots.has(root)) {
        seenLoadableRoots.add(root);

        loadableRoots.push(root);
      }

      attachNotifier(
        internals,
        (notifiers[i] = {
          _ref: weakRef,
          _notify: keyNotify,
          _index: i,
          _current: EMPTY_ARR,
        })
      );

      values[i] = internals._get();
    }

    const combine: (...values: any[]) => any = params[controlCount];

    derivedRoot._mapper = combine;

    derivedRoot._value = combine(...values);

    (derivedRoot as Mutable<typeof derivedRoot>)._notifiers = notifiers;

    derivedRoot._keys = values;

    applyLoadWiring(derivedRoot, loadableRoots);
  } else {
    const internals: ChildControlNode<
      ControlInternals | AsyncControlInternals
    > = params[0][INTERNALS];

    const root = internals._root;

    maxLevel = root._level;

    if (controlCount) {
      const mapper = params[1];

      derivedRoot._mapper = mapper;

      derivedRoot._value = mapper(internals._get());
    } else {
      derivedRoot._value = internals._get();
    }

    if (root._load) {
      (derivedRoot as Mutable<typeof derivedRoot>)._load = root;

      derivedRoot._attach = attachSingleLoad;

      derivedRoot._detach = detachSingleLoad;
    }

    attachNotifier(
      internals,
      ((derivedRoot as Mutable<typeof derivedRoot>)._notifiers = {
        _ref: weakRef,
        _notify: keyNotify,
        _index: 0,
        _current: EMPTY_ARR,
      })
    );
  }

  (derivedRoot as Mutable<typeof derivedRoot>)._level = maxLevel + 1;

  (derivedRoot as Mutable<typeof derivedRoot>)._root = derivedRoot;

  return createScope(derivedRoot);
};

export default makeDerivedControl;
