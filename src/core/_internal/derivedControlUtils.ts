import type {
  ChangeListener,
  ControlInternals,
  ControlInternalsChild,
  Lane,
  Listeners,
  Mutable,
  Notifier,
  Subscription,
} from '#internal/types';
import { addListener, removeListener } from '#internal/flushQueue';
import queuePatch from '#internal/queuePatch';
import attachNotifier from '#internal/attachNotifier';
import removeFromArray from '#internal/removeFromArray';
import { EMPTY_ARR } from '#internal/constants';
import addToQueue from '#internal/addToQueue';
import { actualizePending } from '#internal/cleanup';

export type DerivedControlInternals = ControlInternals &
  Subscription & {
    readonly _load: ReadonlyArray<ControlInternals> | ControlInternals | false;
    _mapper(...args: any[]): any;
    _values: any;
    /** `false` while a source change awaits recompute; local writes are dropped meanwhile */
    _upToDate: boolean;
    readonly _isSingleDependency: boolean;
    /** Its own, in `_values` order; an async one has an error notifier per source too. */
    readonly _sources: ControlInternalsChild[];
    readonly _notifiers: Notifier[];
  };

export function attachSingleLoad(
  this: DerivedControlInternals,
  control: Listeners<ChangeListener> | undefined,
  listener: ChangeListener | undefined,
  isLoad: boolean
) {
  if (listener) {
    addListener(control!, listener);
  }

  (this._load as ControlInternals)._attach(undefined, undefined, isLoad);
}

export function detachSingleLoad(
  this: DerivedControlInternals,
  control: Listeners<ChangeListener> | undefined,
  listener: ChangeListener | undefined,
  isLoad: boolean
) {
  if (listener) {
    removeListener(control!, listener);
  }

  (this._load as ControlInternals)._detach(undefined, undefined, isLoad);
}

function attachMultipleLoads(
  this: DerivedControlInternals,
  control: Listeners<ChangeListener> | undefined,
  listener: ChangeListener | undefined,
  isLoad: boolean
) {
  const loadableDependencies = this._load as ReadonlyArray<ControlInternals>;

  if (listener) {
    addListener(control!, listener);
  }

  for (let i = 0; i < loadableDependencies.length; i++) {
    loadableDependencies[i]._attach(undefined, undefined, isLoad);
  }
}

function detachMultipleLoads(
  this: DerivedControlInternals,
  control: Listeners<ChangeListener> | undefined,
  listener: ChangeListener | undefined,
  isLoad: boolean
) {
  const loadableDependencies = this._load as ReadonlyArray<ControlInternals>;

  if (listener) {
    removeListener(control!, listener);
  }

  for (let i = 0; i < loadableDependencies.length; i++) {
    loadableDependencies[i]._detach(undefined, undefined, isLoad);
  }
}

/**
 * Reads the sources again, a source owing a catch-up of its own going first, so
 * the value read from it is the one it settles on. Leaves `_upToDate` false if
 * any of them moved.
 */
export function readSources(root: DerivedControlInternals) {
  root._pending = undefined;

  const sources = root._sources;

  if (root._isSingleDependency) {
    const source = sources[0];

    actualizePending(source._root);

    const value = source._get();

    if (value !== root._values) {
      root._values = value;

      root._upToDate = false;
    }
  } else {
    const values = root._values;

    for (let i = 0, l = sources.length; i < l; i++) {
      const source = sources[i];

      actualizePending(source._root);

      const value = source._get();

      if (value !== values[i]) {
        values[i] = value;

        root._upToDate = false;
      }
    }
  }
}

/** Every notifier of it, and the sources they make it follow. */
export function subscribeDerived(this: DerivedControlInternals) {
  const root = this;

  const notifiers = root._notifiers;

  for (let i = 0, l = notifiers.length; i < l; i++) {
    const notifier = notifiers[i];

    const source = notifier._source!;

    attachNotifier(source, notifier);

    // a no-op unless the source is a bound child, which has to be active
    // before it holds anything
    source._root._attach(source, undefined, false);
  }

  // nobody read it while it was detached, so the catch-up is still owed
  if (root._pending) {
    root._resync();
  }
}

export function cleanupDerived(this: DerivedControlInternals) {
  const notifiers = this._notifiers;

  for (let i = 0, l = notifiers.length; i < l; i++) {
    const notifier = notifiers[i];

    const attachedTo = notifier._attachedTo;

    if (attachedTo != EMPTY_ARR) {
      removeFromArray(attachedTo, notifier);

      notifier._attachedTo = EMPTY_ARR;
    }
  }

  this._pending = this;
}

export function sourceChangeNotify(this: Notifier, lane: Lane, value: any) {
  const root: DerivedControlInternals = this._target;

  if (root._isSingleDependency) {
    root._values = value;
  } else {
    root._values[this._index] = value;
  }

  root._upToDate = false;

  addToQueue(lane, root);
}

/** Drops the write while sources are stale: the recompute would overwrite it anyway. */
export function enqueueSet(
  this: DerivedControlInternals,
  value: any,
  lane: Lane,
  _fromSource: boolean,
  path: string[] | undefined
) {
  if (this._upToDate) {
    queuePatch(lane, this, value, path);
  }
}

export const applyLoadWiring = (
  root: DerivedControlInternals,
  loadableRoots: ControlInternals[]
) => {
  const count = loadableRoots.length;

  if (count) {
    const mutableRoot = root as Mutable<DerivedControlInternals>;

    if (count == 1) {
      mutableRoot._load = loadableRoots[0];

      mutableRoot._attach = attachSingleLoad;

      mutableRoot._detach = detachSingleLoad;
    } else {
      mutableRoot._load = loadableRoots;

      mutableRoot._attach = attachMultipleLoads;

      mutableRoot._detach = detachMultipleLoads;
    }
  }
};
