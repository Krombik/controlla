import identity from '#internal/identity';
import noop from '#internal/noop';
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
  commitRootPatch,
  commitRootValue,
  UNCHANGED,
} from '#internal/commitPatchNode';
import { attach, detach } from '#internal/syncLifecycle';
import {
  applyLoadWiring,
  cleanupDerived,
  readSources,
  subscribeDerived,
  enqueueSet,
  sourceChangeNotify,
  type DerivedControlInternals,
} from '#internal/derivedControlUtils';
import { commitErrorValue, commitStatusValue } from '#internal/commitStatus';
import makeStatusInternals from '#internal/makeStatusInternals';
import throwReadonlyError from '#internal/throwReadonlyError';
import settlePromise from '#internal/settlePromise';
import armPromise from '#internal/armPromise';
import addToQueue from '#internal/addToQueue';
import { AggregateControlError } from '#internal/AggregateControlError';
import { notify, silentLane } from '#internal/flushQueue';
import { registerSubscription } from '#internal/cleanup';
import { sourceUpdate } from '#internal/sourceUpdate';

interface AsyncDerivedControlInternals
  extends
    DerivedControlInternals,
    AsyncStatusControls<AsyncDerivedControlInternals> {
  readonly _errors: any[];
  /** Drops the sources on the first ready value */
  readonly _once: boolean;
}

function sourceErrorNotify(this: Notifier, lane: Lane, value: any) {
  const root: AsyncDerivedControlInternals = this._target;

  root._errors[this._index] = value;

  root._upToDate = false;

  addToQueue(lane, root);
}

function enqueueDerivedErrorSet(
  this: ErrorControlInternals<AsyncDerivedControlInternals>,
  value: any,
  lane: Lane,
  fromSource: boolean,
  path: string[] | undefined
) {
  if (value !== RELOAD && value !== SILENT_RELOAD) {
    throwReadonlyError();
  }

  const parent = this._parent;

  if (!parent._promise) {
    // nobody has to be awaiting it yet, and a failed reload rejects it
    armPromise(parent).catch(noop);
  }

  const load = parent._load;

  if (load) {
    if (Array.isArray(load)) {
      for (let i = 0; i < load.length; i++) {
        (load[i] as AsyncControlInternals)._errorControl[INTERNALS]._enqueueSet(
          value,
          lane,
          fromSource,
          path
        );
      }
    } else {
      (load as AsyncControlInternals)._errorControl[INTERNALS]._enqueueSet(
        value,
        lane,
        fromSource,
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
    const nextValue = commitRootPatch(root, patchNode, prevValue, lane);

    if (nextValue !== UNCHANGED) {
      notify(root, lane, nextValue, prevValue);

      root._setExternal(nextValue);

      if (nextValue !== undefined) {
        settlePromise(root, true, nextValue);
      }
    }

    return;
  }

  root._upToDate = true;

  sourceUpdate._value = true;

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
    // a cleared slot changes the aggregate even if the remaining errors are identical
    if (hadClearedError && status == Status.ERROR_UNCHANGED) {
      status = Status.ERROR_CHANGED;
    }

    errors[count] = undefined;
  }

  const nextValue = commitRootValue(root, next, prevValue, lane);

  if (nextValue !== UNCHANGED) {
    notify(root, lane, nextValue, prevValue);

    root._setExternal(nextValue);

    if (nextValue !== undefined) {
      settlePromise(root, true, nextValue);
    }
  } else if (status == Status.READY) {
    // a reload can answer with what it already had - what was awaited is the
    // recompute, not a change
    settlePromise(root, true, prevValue);
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

  sourceUpdate._value = false;

  // the value it was after, so nothing is left listening for another one
  if (root._once && status == Status.READY) {
    root._cleanup();

    // it has the value it was after, so there is nothing left to catch up with
    root._pending = undefined;
  }
}

/** {@link readSources}, plus the errors of the sources it also stopped hearing. */
function resyncAsyncDerived(this: AsyncDerivedControlInternals) {
  // first, so the errors read below are the ones the sources settle on - a
  // source owing a catch-up of its own is where one of them comes from
  readSources(this);

  const sources = this._sources;

  const errors = this._errors;

  for (let i = 0, l = sources.length; i < l; i++) {
    const errorControl = (sources[i]._root as AsyncControlInternals)
      ._errorControl;

    if (errorControl) {
      const error = errorControl[INTERNALS]._value;

      if (error !== errors[i]) {
        errors[i] = error;

        // an error of its own is what the recompute below turns it into
        this._upToDate = false;
      }
    }
  }

  // unlike a plain derived, what it computes is not the mapper's answer alone -
  // the loading and error status is settled in the commit, which tells nobody
  // here
  if (!this._upToDate) {
    this._commitSet(null, silentLane);
  }
}

const makeAsyncDerivedControl = (params: any[], once: boolean) => {
  const controlCount = params.length - 1;

  const isSingle = controlCount < 2;

  const sourceCount = isSingle ? 1 : controlCount;

  const errors: any[] = Array(sourceCount + 1);

  const values = Array(sourceCount);

  const notifiers: Notifier[] = [];

  const sources: Array<ChildControlNode<ControlInternals>> = Array(sourceCount);

  const loadableSources: ControlInternals[] = [];

  const mapper = params[sourceCount] || identity;

  const seenLoadableSources = new Set<ControlInternals>();

  const derivedRoot: AsyncDerivedControlInternals = {
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
    _commitSet: commitSet,
    _sources: sources,
    _notifiers: notifiers,
    _subscribe: subscribeDerived,
    _cleanup: cleanupDerived,
    _resync: resyncAsyncDerived,
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
    _errorControl: undefined!,
    _loadingControl: undefined!,
    _readyControl: undefined!,
    _promise: undefined,
    _errors: errors,
    _once: once,
  };

  let maxLevel = 0;

  let isReady = true;

  let isNoError = true;

  for (let i = 0; i < sourceCount; i++) {
    const internals: ChildControlNode<
      ControlInternals | AsyncControlInternals
    > = (sources[i] = params[i][INTERNALS]);

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

    if (root._load && !seenLoadableSources.has(root)) {
      seenLoadableSources.add(root);

      loadableSources.push(root);
    }

    if (errorControl) {
      const errorInternals = errorControl[INTERNALS];

      const errorValue = errorInternals._value;

      errors[i] = errorValue;

      if (isNoError && errorValue !== undefined) {
        isNoError = false;
      }

      notifiers.push({
        _target: derivedRoot,
        _notify: sourceErrorNotify,
        _index: i,
        _attachedTo: EMPTY_ARR,
        _source: errorInternals,
      });
    }

    notifiers.push({
      _target: derivedRoot,
      _notify: sourceChangeNotify,
      _index: i,
      _attachedTo: EMPTY_ARR,
      _source: internals,
    });
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

  applyLoadWiring(derivedRoot, loadableSources);

  (derivedRoot as Mutable<typeof derivedRoot>)._root = derivedRoot;

  const errorInternals: ErrorControlInternals<AsyncDerivedControlInternals> = {
    _root: undefined!,
    _pending: undefined,
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

  // everything was there already, so nothing has to be watched for
  if (!once || !isReady) {
    registerSubscription(derivedRoot, derivedRoot);
  }

  return createScope(derivedRoot);
};

export default makeAsyncDerivedControl;
