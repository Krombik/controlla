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
  Lane,
  PatchTreeNode,
  AsyncThings,
  ErrorControlInternals,
  Notifier,
} from '#internal/types';
import {
  commitNextValue,
  commitPatchNode,
  UNCHANGED,
} from '#internal/commitPatchNode';
import notify from '#internal/notify';
import { attach, detach } from '#internal/syncLifecycle';
import attachNotifier from '#internal/attachNotifier';
import {
  attachMultipleLoads,
  attachSingleLoad,
  detachMultipleLoads,
  detachSingleLoad,
  enqueueSet,
  keyNotify,
  type DerivedControlInternals,
} from '#internal/derivedControlUtils';
import makeStatusInternals from '#internal/makeStatusInternals';
import throwReadonlyError from '#internal/throwReadonlyError';
import addToQueue from '#internal/addToQueue';

interface AsyncDerivedControlInternals
  extends DerivedControlInternals, AsyncThings<AsyncDerivedControlInternals> {
  readonly _errors: any[] | undefined;
}

function keyErrorNotify(
  this: Notifier,
  lane: Lane,
  root: AsyncDerivedControlInternals,
  value: any,
  _: any
) {
  if (root._errors) {
    root._errors[this._index] = value;
  }

  root._equable = false;

  addToQueue(lane, root);
}

function commitSet(
  this: AsyncDerivedControlInternals,
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
  const controlCount = params.length - 1;

  const errorInternals: ErrorControlInternals<AsyncDerivedControlInternals> = {
    [INTERNALS]: undefined!,
    _attach: attach,
    _detach: detach,
    _dependents: EMPTY_ARR,
    _enqueueSet: throwReadonlyError,
    _get: readRootValue,
    _indexMap: undefined,
    _level: 0,
    _listeners: EMPTY_ARR,
    _load: true,
    _parent: undefined!,
    _path: undefined,
    _value: undefined,
  };

  const loadingInternals = makeStatusInternals(undefined!, true);

  const readyInternals = makeStatusInternals(undefined!, undefined);

  const derivedRoot: AsyncDerivedControlInternals = {
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
    _load: false,
    _mapper: identity,
    _keys: undefined,
    _isSingleDependency: controlCount < 2,
    _equable: true,
    _notifiers: undefined!,
    _errorControl: { [INTERNALS]: errorInternals },
    _loadingControl: { [INTERNALS]: loadingInternals },
    _readyControl: { [INTERNALS]: readyInternals },
    _promise: undefined,
    _errors: undefined,
  };

  const weakRef = new WeakRef(derivedRoot);

  let maxLevel = 0;

  let errors;

  if (controlCount > 1) {
    const seenLoadableRoots = new Set<ControlInternals>();

    const loadableRoots: Array<ControlInternals> = [];

    const values = Array(controlCount);

    const notifiers = Array(controlCount);

    for (let i = 0; i < controlCount; i++) {
      const internals: ChildControlNode<
        ControlInternals | AsyncControlInternals
      > = params[i][INTERNALS];

      const root = internals[INTERNALS];

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

    const loaderCount = loadableRoots.length;

    derivedRoot._mapper = combine;

    derivedRoot._value = combine(...values);

    (derivedRoot as Mutable<typeof derivedRoot>)._notifiers = notifiers;

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

    const root = internals[INTERNALS];

    const keyErrorControl = (root as AsyncControlInternals)._errorControl;

    maxLevel = root._level;

    if (controlCount) {
      const mapper = params[1];

      derivedRoot._mapper = mapper;

      if (keyErrorControl) {
        const errorValue = keyErrorControl[INTERNALS]._value;

        (derivedRoot as Mutable<typeof derivedRoot>)._errors = errors = [
          errorValue,
          undefined,
        ];

        if (errorValue === undefined) {
          if (root._value !== undefined) {
            try {
              derivedRoot._value = mapper(internals._get());
            } catch (error) {
              errors[1] = error;

              errorInternals._value = errors.slice();
            }
          }
        } else {
          errorInternals._value = errors.slice();
        }
      } else if (root._value !== undefined) {
        try {
          derivedRoot._value = mapper(internals._get());
        } catch (error) {
          errorInternals._value = error;
        }
      }
    } else {
      if (keyErrorControl) {
        const errorValue = keyErrorControl[INTERNALS]._value;

        if (errorValue === undefined) {
          derivedRoot._value = internals._get();
        } else {
          errorInternals._value = errorValue;
        }
      } else {
        derivedRoot._value = internals._get();
      }
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

  (derivedRoot as Mutable<typeof derivedRoot>)[INTERNALS] = derivedRoot;

  return createScope(derivedRoot);
};

export default makeDerivedControl;
