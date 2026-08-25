import type {
  AsyncControlInternals,
  Mutable,
  PrimitiveControlInternals,
} from '#internal/types';
import type { SyncExternalStorage } from '#types';
import {
  getSchedulerLane,
  scheduleFlush,
  silentLane,
} from '#internal/flushQueue';
import { commitRootValue } from '#internal/commitPatchNode';
import { INTERNALS, RELOAD } from '#internal/constants';
import reportError from '#internal/reportError';
import { cleanupScope, registerSubscription } from '#internal/cleanup';
import noop from '#internal/noop';
import type { Subscription } from '#internal/types';

type StorageSubscription = Subscription & {
  _externalStorage: ReturnType<SyncExternalStorage>;
  _listener(value: any): void;
  _unobserve(): void;
  readonly _isSync: boolean;
  readonly _root: PrimitiveControlInternals;
};

// keep the storage as the receiver, `observe` and `get` may be methods
function observe(this: StorageSubscription) {
  this._unobserve = this._externalStorage.observe!(this._listener);

  // nobody read the control while nothing observed, so the catch-up is owed
  if (this._root._pending) {
    this._resync();
  }
}

/**
 * Reads the storage again: a write in the window where nothing observed it -
 * between the render and the commit, or an `Activity` being hidden - is one
 * nothing told the control about.
 */
function resyncStorage(this: StorageSubscription) {
  const root = this._root;

  root._pending = undefined;

  let value;

  try {
    value = this._externalStorage.get();
  } catch (err) {
    reportError(err);

    return;
  }

  // what the listener is told when it observes one, on the same terms: for a
  // sync control an emptied storage is a value of its own, for an async one it
  // is nothing to hear
  if ((this._isSync || value !== undefined) && value !== root._value) {
    // committed, not written: a storage read is a new object every time, and
    // what it compares to is what decides whether it replaces one. Silent -
    // see `resyncDerived`
    commitRootValue(root as any, value, root._value, silentLane);
  }
}

function unobserve(this: StorageSubscription) {
  this._root._pending = this;

  this._unobserve();

  this._unobserve = noop;
}

const initControl = <I extends PrimitiveControlInternals>(
  internals: I,
  initialValue: unknown | (() => unknown) | undefined,
  syncExternalStorage: SyncExternalStorage | undefined,
  keys: any[] | undefined,
  isSync: boolean
): I => {
  (internals as Mutable<I>)._root = internals;

  const resolvedInitial =
    typeof initialValue != 'function'
      ? initialValue
      : keys
        ? initialValue(...keys)
        : initialValue();

  if (syncExternalStorage) {
    const externalStorage = syncExternalStorage(keys);

    let storageValue;

    try {
      storageValue = externalStorage.get();
    } catch (err) {
      reportError(err);

      internals._value = resolvedInitial;

      return internals;
    }

    if (externalStorage.observe) {
      const listener = (value: any) => {
        const lane = getSchedulerLane();

        if (isSync || value !== undefined) {
          // sync storage was cleared externally - fall back to the initial
          // value, leaving the storage empty so tabs don't race to reseed it
          if (isSync && value === undefined && resolvedInitial !== undefined) {
            value = resolvedInitial;
          }

          internals._enqueueSet(value, lane, true);
        } else {
          (internals as any as AsyncControlInternals)._errorControl[
            INTERNALS
          ]._enqueueSet(RELOAD, lane, true);
        }

        scheduleFlush(lane);
      };

      if (cleanupScope._value) {
        const subscription: StorageSubscription = {
          _externalStorage: externalStorage,
          _isSync: isSync,
          _root: internals,
          _listener: listener,
          _unobserve: noop,
          _subscribe: observe,
          _cleanup: unobserve,
          _resync: resyncStorage,
        };

        // the scope announces the catch-up it owes for as long as it holds it
        registerSubscription(internals, subscription);
      } else {
        // no scope to ever unobserve it, so it observes from here on
        externalStorage.observe(listener);
      }
    }

    const setExternal = (value: any) => {
      try {
        externalStorage.set(value);
      } catch (err) {
        reportError(err);
      }
    };

    if (storageValue !== undefined) {
      internals._value = storageValue;
    } else {
      if (resolvedInitial !== undefined) {
        setExternal(resolvedInitial);

        internals._value = resolvedInitial;
      }
    }

    // keep the storage as the receiver — `set` may be a method
    (internals as Mutable<I>)._setExternal = setExternal;
  } else {
    internals._value = resolvedInitial;
  }

  return internals;
};

export default initControl;
