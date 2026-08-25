import identity from '#internal/identity';
import noop from '#internal/noop';
import { INTERNALS, EMPTY_ARR } from '#internal/constants';
import createScope from '#internal/createScope';
import readRootValue from '#internal/readRootValue';
import type {
  AsyncControlInternals,
  ChildControlNode,
  ControlInternalsChild,
  Mutable,
  ControlInternals,
  Lane,
  PatchTreeNode,
  Notifier,
} from '#internal/types';
import {
  commitRootPatch,
  commitRootValue,
  UNCHANGED,
} from '#internal/commitPatchNode';
import { attach, detach } from '#internal/syncLifecycle';
import {
  applyLoadWiring,
  attachSingleLoad,
  cleanupDerived,
  detachSingleLoad,
  enqueueSet,
  readSources,
  sourceChangeNotify,
  subscribeDerived,
  type DerivedControlInternals,
} from '#internal/derivedControlUtils';
import { notify, silentLane } from '#internal/flushQueue';
import reportError from '#internal/reportError';
import { registerSubscription } from '#internal/cleanup';
import { sourceUpdate } from '#internal/sourceUpdate';

function resyncDerived(this: DerivedControlInternals) {
  const root = this;

  readSources(root);

  // what it computed last is still what it computes
  if (!root._upToDate) {
    root._upToDate = true;

    let next;

    try {
      // kept, unlike the commit's: what the sources are compared against next
      // time is what they read as this time
      next = root._isSingleDependency
        ? root._mapper(root._values)
        : root._mapper(...root._values);
    } catch (err) {
      reportError(err);

      return;
    }

    // committed, not written: a source moving is no reason for what it derives
    // to be another object, and replacing one is a rerender for nothing. Silent
    // - nothing of the commit is attached to hear it
    commitRootValue(root, next, root._value, silentLane);
  }
}

function commitSet(
  this: DerivedControlInternals,
  patchNode: PatchTreeNode,
  lane: Lane
) {
  const root = this;

  const prevValue = root._value;

  if (root._upToDate) {
    const nextValue = commitRootPatch(root, patchNode, prevValue, lane);

    if (nextValue !== UNCHANGED) {
      notify(root, lane, nextValue, prevValue);
    }

    return;
  }

  let next;

  root._upToDate = true;

  try {
    // single-dependency mode keeps the latest source value itself in _values
    if (root._isSingleDependency) {
      next = root._mapper(root._values);

      root._values = undefined;
    } else {
      next = root._mapper(...root._values);
    }
  } catch (err) {
    reportError(err);

    return;
  }

  sourceUpdate._value = true;

  const nextValue = commitRootValue(root, next, prevValue, lane);

  if (nextValue !== UNCHANGED) {
    notify(root, lane, nextValue, prevValue);
  }

  sourceUpdate._value = false;
}

const makeDerivedControl = (params: any[]) => {
  let maxLevel = 0;

  const controlCount = params.length - 1;

  const sources: ControlInternalsChild[] = Array(controlCount || 1);

  const notifiers: Notifier[] = Array(controlCount || 1);

  const derivedRoot: DerivedControlInternals = {
    _root: undefined!,
    _pending: undefined,
    _get: readRootValue,
    _listeners: EMPTY_ARR,
    _indexMap: undefined,
    _dependents: EMPTY_ARR,
    _path: undefined,
    _children: undefined,
    _storage: undefined,
    _setExternal: noop,
    _sources: sources,
    _notifiers: notifiers,
    _subscribe: subscribeDerived,
    _cleanup: cleanupDerived,
    _resync: resyncDerived,
    _commitSet: commitSet,
    _enqueueSet: enqueueSet,
    _level: 0,
    _value: undefined,
    _attach: attach,
    _detach: detach,
    _load: false,
    _mapper: identity,
    _values: undefined,
    _isSingleDependency: controlCount < 2,
    _upToDate: true,
  };

  if (controlCount > 1) {
    const seenLoadableSources = new Set<ControlInternals>();

    const loadableSources: Array<ControlInternals> = [];

    const values = Array(controlCount);

    for (let i = 0; i < controlCount; i++) {
      const internals: ChildControlNode<
        ControlInternals | AsyncControlInternals
      > = (sources[i] = params[i][INTERNALS]);

      const root = internals._root;

      if (root._level > maxLevel) {
        maxLevel = root._level;
      }

      if (root._load && !seenLoadableSources.has(root)) {
        seenLoadableSources.add(root);

        loadableSources.push(root);
      }

      notifiers[i] = {
        _target: derivedRoot,
        _notify: sourceChangeNotify,
        _index: i,
        _attachedTo: EMPTY_ARR,
        _source: internals,
      };

      values[i] = internals._get();
    }

    const combine: (...values: any[]) => any = params[controlCount];

    derivedRoot._mapper = combine;

    derivedRoot._value = combine(...values);

    derivedRoot._values = values;

    applyLoadWiring(derivedRoot, loadableSources);
  } else {
    const internals: ChildControlNode<
      ControlInternals | AsyncControlInternals
    > = params[0][INTERNALS];

    const root = internals._root;

    notifiers[0] = {
      _target: derivedRoot,
      _notify: sourceChangeNotify,
      _index: 0,
      _attachedTo: EMPTY_ARR,
      _source: (sources[0] = internals),
    };

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
  }

  (derivedRoot as Mutable<typeof derivedRoot>)._level = maxLevel + 1;

  (derivedRoot as Mutable<typeof derivedRoot>)._root = derivedRoot;

  registerSubscription(derivedRoot, derivedRoot);

  return createScope(derivedRoot);
};

export default makeDerivedControl;
