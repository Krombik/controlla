import identity from 'lodash.identity';
import noop from 'lodash.noop';
import { INTERNALS } from '#internal/constants';
import { EMPTY_ARR, RELOAD, SILENT_RELOAD } from '#internal/constants';
import createScope from '#internal/createScope';
import readRootValue from '#internal/readRootValue';
import type {
  AsyncControlInternals,
  ChildControlNode,
  Mutable,
  ControlInternals,
  Lane,
  PatchTreeNode,
  AsyncStatusControls,
  ErrorControlInternals,
  Notifier,
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
  enqueueSet,
  sourceChangeNotify,
  type DerivedControlInternals,
} from '#internal/derivedControlUtils';
import { commitErrorValue, commitStatusValue } from '#internal/commitStatus';
import makeStatusInternals from '#internal/makeStatusInternals';
import throwReadonlyError from '#internal/throwReadonlyError';
import settlePromise from '#internal/settlePromise';
import addToQueue from '#internal/addToQueue';
import { AggregateControlError } from '#internal/AggregateControlError';
import { notify } from '#internal/flushQueue';

interface AsyncDerivedControlInternals
  extends
    DerivedControlInternals,
    AsyncStatusControls<AsyncDerivedControlInternals> {
  readonly _errors: any[];
}

function sourceErrorNotify(
  this: Notifier,
  lane: Lane,
  root: AsyncDerivedControlInternals,
  value: any,
  _: any
) {
  root._errors[this._index] = value;

  root._upToDate = false;

  addToQueue(lane, root);
}

function enqueueDerivedErrorSet(
  this: ErrorControlInternals<AsyncDerivedControlInternals>,
  value: any,
  lane: Lane,
  path: string[] | undefined
) {
  if (value !== RELOAD && value !== SILENT_RELOAD) {
    throwReadonlyError();
  }

  const load = this._parent._load;

  if (load) {
    if (Array.isArray(load)) {
      for (let i = 0; i < load.length; i++) {
        (load[i] as AsyncControlInternals)._errorControl[INTERNALS]._enqueueSet(
          value,
          lane,
          path
        );
      }
    } else {
      (load as AsyncControlInternals)._errorControl[INTERNALS]._enqueueSet(
        value,
        lane,
        path
      );
    }
  } else if (process.env.NODE_ENV !== 'production') {
    console.warn(
      '[derived] invalidate on a derived control with no loadable dependencies was ignored.'
    );
  }
}

function commitSet(
  this: AsyncDerivedControlInternals,
  patchNode: PatchTreeNode,
  lane: Lane
) {
  const root = this;

  const prevValue = root._value;

  if (root._upToDate) {
    const nextValue = commitPatchNode(patchNode, prevValue, root, lane);

    if (nextValue !== UNCHANGED) {
      root._value = nextValue;

      notify(root._listeners, root._dependents, lane, nextValue, prevValue);

      root._setExternal(nextValue);

      if (nextValue !== undefined) {
        settlePromise(root, true, nextValue);
      }
    }

    return;
  }

  root._upToDate = true;

  const errors = root._errors;

  const errorInternals = root._errorControl[INTERNALS];

  const isSingle = root._isSingleDependency;

  const values = root._values;

  const count = isSingle ? 1 : (values as any[]).length;

  const prevError: AggregateControlError | undefined = errorInternals._value;

  const prevErrors = prevError && prevError.errors;

  const enum Status {
    LOADING,
    READY,
    ERROR_UNCHANGED,
    ERROR_CHANGED,
  }

  let status = Status.READY;

  let hadClearedError = false;

  for (let i = 0; i < count; i++) {
    if (
      status == Status.READY &&
      (isSingle ? values : values[i]) === undefined
    ) {
      status = Status.LOADING;
    }

    const err = errors[i];

    if (err !== undefined) {
      if (!prevErrors || err !== prevErrors[i]) {
        status = Status.ERROR_CHANGED;

        break;
      } else {
        status = Status.ERROR_UNCHANGED;
      }
    } else if (prevErrors && prevErrors[i] !== undefined) {
      hadClearedError = true;
    }
  }

  let next: any;

  if (status == Status.READY) {
    try {
      next = isSingle ? root._mapper(values) : root._mapper(...values);

      errors[count] = undefined;

      if (next === undefined) {
        status = Status.LOADING;
      }
    } catch (error) {
      if (error !== errors[count]) {
        errors[count] = error;

        status = Status.ERROR_CHANGED;
      } else {
        status = Status.ERROR_UNCHANGED;
      }
    }
  } else {
    if (hadClearedError && status == Status.ERROR_UNCHANGED) {
      status = Status.ERROR_CHANGED;
    }

    errors[count] = undefined;
  }

  const nextValue = commitNextValue(next, prevValue, root, lane);

  if (nextValue !== UNCHANGED) {
    root._value = nextValue;

    notify(root._listeners, root._dependents, lane, nextValue, prevValue);

    root._setExternal(nextValue);

    if (nextValue !== undefined) {
      settlePromise(root, true, nextValue);
    }
  }

  commitErrorValue(
    root,
    errorInternals,
    status > Status.READY
      ? status == Status.ERROR_CHANGED
        ? new AggregateControlError(errors)
        : prevError
      : undefined,
    lane
  );

  commitStatusValue(
    root._loadingControl[INTERNALS],
    status == Status.LOADING,
    lane
  );

  commitStatusValue(
    root._readyControl[INTERNALS],
    status == Status.READY || undefined,
    lane
  );
}

const makeAsyncDerivedControl = (params: any[]) => {
  const controlCount = params.length - 1;

  const isSingle = controlCount < 2;

  const sourceCount = isSingle ? 1 : controlCount;

  const errors: any[] = Array(sourceCount + 1);

  const values = Array(sourceCount);

  const notifiers: Notifier[] = [];

  const loadableRoots: ControlInternals[] = [];

  const mapper = params[sourceCount] || identity;

  const seenLoadableRoots = new Set<ControlInternals>();

  const derivedRoot: AsyncDerivedControlInternals = {
    _root: undefined!,
    _get: readRootValue,
    _listeners: EMPTY_ARR,
    _indexMap: undefined,
    _dependents: EMPTY_ARR,
    _path: undefined,
    _children: undefined,
    _storage: undefined,
    _setExternal: noop,
    _commitSet: commitSet,
    _enqueueSet: enqueueSet,
    _level: 0,
    _value: undefined,
    _attach: attach,
    _detach: detach,
    _load: false,
    _mapper: mapper,
    _values: undefined,
    _isSingleDependency: isSingle,
    _upToDate: true,
    _notifiers: notifiers,
    _errorControl: undefined!,
    _loadingControl: undefined!,
    _readyControl: undefined!,
    _promise: undefined,
    _errors: errors,
  };

  const weakRef = new WeakRef(derivedRoot);

  let maxLevel = 0;

  let isReady = true;

  let isNoError = true;

  for (let i = 0; i < sourceCount; i++) {
    const internals: ChildControlNode<
      ControlInternals | AsyncControlInternals
    > = params[i][INTERNALS];

    const root = internals._root;

    const errorControl = (root as AsyncControlInternals)._errorControl;

    const keyValue = internals._get();

    values[i] = keyValue;

    if (isReady && keyValue === undefined) {
      isReady = false;
    }

    if (root._level > maxLevel) {
      maxLevel = root._level;
    }

    if (root._load && !seenLoadableRoots.has(root)) {
      seenLoadableRoots.add(root);

      loadableRoots.push(root);
    }

    if (errorControl) {
      const errorInternals = errorControl[INTERNALS];

      const errorValue = errorInternals._value;

      errors[i] = errorValue;

      if (isNoError && errorValue !== undefined) {
        isNoError = false;
      }

      const errorNotifier: Notifier = {
        _ref: weakRef,
        _notify: sourceErrorNotify,
        _index: i,
        _attachedTo: EMPTY_ARR,
      };

      attachNotifier(errorInternals, errorNotifier);

      notifiers.push(errorNotifier);
    }

    const notifier: Notifier = {
      _ref: weakRef,
      _notify: sourceChangeNotify,
      _index: i,
      _attachedTo: EMPTY_ARR,
    };

    attachNotifier(internals, notifier);

    notifiers.push(notifier);
  }

  derivedRoot._values = isSingle ? values[0] : values;

  if (isReady) {
    try {
      const value = isSingle ? mapper(values[0]) : mapper(...values);

      derivedRoot._value = value;

      if (value === undefined) {
        isReady = false;
      }
    } catch (error) {
      errors[sourceCount] = error;

      isNoError = false;

      isReady = false;
    }
  }

  applyLoadWiring(derivedRoot, loadableRoots);

  (derivedRoot as Mutable<typeof derivedRoot>)._root = derivedRoot;

  const errorInternals: ErrorControlInternals<AsyncDerivedControlInternals> = {
    _root: undefined!,
    _attach: attach,
    _detach: detach,
    _dependents: EMPTY_ARR,
    _enqueueSet: enqueueDerivedErrorSet,
    _get: readRootValue,
    _indexMap: undefined,
    _level: ((derivedRoot as Mutable<typeof derivedRoot>)._level =
      maxLevel + 1),
    _listeners: EMPTY_ARR,
    _load: derivedRoot._load !== false,
    _parent: derivedRoot,
    _path: undefined,
    _value: isNoError ? undefined : new AggregateControlError(errors),
  };

  (errorInternals as Mutable<typeof errorInternals>)._root = errorInternals;

  (derivedRoot as Mutable<typeof derivedRoot>)._errorControl = {
    [INTERNALS]: errorInternals,
  };

  (derivedRoot as Mutable<typeof derivedRoot>)._loadingControl = {
    [INTERNALS]: makeStatusInternals(derivedRoot, isNoError && !isReady),
  };

  (derivedRoot as Mutable<typeof derivedRoot>)._readyControl = {
    [INTERNALS]: makeStatusInternals(derivedRoot, isReady || undefined),
  };

  return createScope(derivedRoot);
};

export default makeAsyncDerivedControl;
