import type {
  ChangeListener,
  ControlInternals,
  Lane,
  Listeners,
  Mutable,
  Notifier,
} from '#internal/types';
import { addListener, removeListener } from '#internal/flushQueue';
import runPatching from '#internal/runPatching';
import addToQueue from '#internal/addToQueue';

export type DerivedControlInternals = ControlInternals & {
  readonly _load: ReadonlyArray<ControlInternals> | ControlInternals | false;
  readonly _notifiers: Notifier | Notifier[];
  _mapper(...args: any[]): any;
  _keys: any;
  _equable: boolean;
  readonly _isSingleDependency: boolean;
};

export function attachSingleLoad(
  this: DerivedControlInternals,
  control: Listeners<ChangeListener>,
  listener: ChangeListener,
  isLoad: boolean
) {
  addListener(control, listener);

  (this._load as ControlInternals)._attach(undefined, undefined, isLoad);
}

export function detachSingleLoad(
  this: DerivedControlInternals,
  control: Listeners<ChangeListener>,
  listener: ChangeListener,
  isLoad: boolean
) {
  removeListener(control, listener);

  (this._load as ControlInternals)._detach(undefined, undefined, isLoad);
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

export function keyNotify(
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

  root._equable = false;

  addToQueue(lane, root);
}

export function enqueueSet(
  this: DerivedControlInternals,
  value: any,
  lane: Lane,
  path: string[] | undefined
) {
  if (this._equable) {
    runPatching(lane, this, value, path);
  }
}

/**
 * Wires the derived control's load dependencies based on the collected
 * loadable roots. Mutates the passed root in place — allocates nothing.
 */
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
