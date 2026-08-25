import type {
  ChangeListener,
  Lane,
  Listeners,
  Mutable,
  Notifier,
} from '#internal/types';
import type { Scheduler } from '#types';
import scheduleMicrotask from '#internal/scheduleMicrotask';
import reportError from '#internal/reportError';
import noop from '#internal/noop';

type NotifiableInternals = {
  readonly _listeners: ChangeListener[];
  readonly _dependents: Notifier[];
};

/** Listener add/remove during notify is deferred to keep the iterated array stable. */
const NOT_ITERATED: readonly Function[] = [];

const deferredListenerChanges: any[] = [];

const pendingLanes: Array<() => void> = [];

let iteratedListeners = NOT_ITERATED;

let currentLane: Lane | null = null;

export const notify = (
  internals: NotifiableInternals,
  lane: Lane,
  value: any,
  prevValue: any
) => {
  if (lane._silent) {
    return;
  }

  const listeners = internals._listeners;

  const listenersCount = listeners.length;

  if (listenersCount) {
    iteratedListeners = listeners;

    for (let i = 0; i < listenersCount; i++) {
      try {
        listeners[i](value, prevValue);
      } catch (err) {
        reportError(err);
      }
    }

    iteratedListeners = NOT_ITERATED;

    const l = deferredListenerChanges.length;

    if (l) {
      for (let i = 0; i < l; i += 3) {
        deferredListenerChanges[i](
          deferredListenerChanges[i + 1],
          deferredListenerChanges[i + 2]
        );
      }

      deferredListenerChanges.length = 0;
    }
  }

  const dependents = internals._dependents;

  for (let i = 0, l = dependents.length; i < l; i++) {
    const item = dependents[i];

    item._notify(lane, value, prevValue);
  }
};

/**
 * What a commit collected on its way down, waiting for the root value it belongs
 * to.
 */
const pendingNotifications: any[] = [];

/** {@link notify}, deferred until {@link flushNotifications}. */
export const queueNotify = pendingNotifications.push.bind(
  pendingNotifications
) as (
  internals: NotifiableInternals,
  lane: Lane,
  value: any,
  prevValue: any
) => void;

/**
 * Runs what the commit collected, once its root value is in place - a listener
 * reading any control, its own included, goes through that value.
 *
 * Nothing is collected for a commit that changes nothing, so this is a no-op for
 * one.
 */
export const flushNotifications = () => {
  for (let i = 0; i < pendingNotifications.length; i += 4) {
    notify(
      pendingNotifications[i],
      pendingNotifications[i + 1],
      pendingNotifications[i + 2],
      pendingNotifications[i + 3]
    );
  }

  pendingNotifications.length = 0;
};

const flushLanes = new WeakMap<Scheduler, Lane>();

/**
 * The lane a catch-up writes through. Nothing is told about it: it runs while
 * React commits, before anything of that commit is attached, and telling a
 * dependent is what would queue one - so nothing lands here either, and it is
 * never flushed.
 */
export const silentLane: Lane = {
  _scheduler: noop,
  _beforeFlushHooks: [],
  _canScheduleFlush: false,
  _patchByControl: new Map(),
  _pendingControlLevels: [],
  _minPendingLevel: Infinity,
  _maxPendingLevel: 0,
  _silent: true,
};

const flushQueue = (
  lane: Lane,
  pendingControlLevels: Lane['_pendingControlLevels'],
  patchByControl: Lane['_patchByControl'],
  maxLevel?: number
) => {
  for (
    let level = lane._minPendingLevel;
    level < (maxLevel || lane._maxPendingLevel);
    lane._minPendingLevel = ++level
  ) {
    const pendingInternals = pendingControlLevels[level];

    if (pendingInternals) {
      for (let i = 0; i < pendingInternals.length; i++) {
        const internals = pendingInternals[i];

        const data = patchByControl.get(internals)!;

        patchByControl.delete(internals);

        internals._commitSet(data, lane);

        // the commit enqueued lower-level items - drain them before continuing
        if (lane._minPendingLevel < level) {
          flushQueue(lane, pendingControlLevels, patchByControl, level);
        }
      }

      pendingInternals.length = 0;
    }
  }
};

/** Runs the lane now, rather than when its scheduler would have. */
export const flushLane = (lane: Lane) => {
  if (currentLane) {
    pendingLanes.push(() => flushLane(lane));

    return;
  }

  const { _beforeFlushHooks: beforeFlushHooks } = lane;

  currentLane = lane;

  for (let i = 0; i < beforeFlushHooks.length; i++) {
    try {
      beforeFlushHooks[i]();
    } catch (err) {
      reportError(err);
    }
  }

  beforeFlushHooks.length = 0;

  flushQueue(lane, lane._pendingControlLevels, lane._patchByControl);

  currentLane = null;

  lane._minPendingLevel = Infinity;

  lane._maxPendingLevel = 0;

  lane._canScheduleFlush = true;

  const pendingLanesCount = pendingLanes.length;

  if (pendingLanesCount) {
    const copy = pendingLanes.slice();

    pendingLanes.length = 0;

    for (let i = 0; i < pendingLanesCount; i++) {
      copy[i]();
    }
  }
};

export const scheduleFlush = (lane: Lane) => {
  const scheduler = lane._scheduler;

  if (lane._canScheduleFlush) {
    lane._canScheduleFlush = false;

    scheduler(() => flushLane(lane));
  }

  if ('_debounce' in scheduler && lane !== currentLane) {
    scheduler._debounce!();
  }
};

export const getCurrentLane = () => currentLane;

export const getSchedulerLane = (scheduler?: Scheduler) =>
  ((!scheduler || scheduler._sync) && currentLane) ||
  getLane(scheduler || scheduleMicrotask);

export const getLane = (scheduler: Scheduler) => {
  let lane = flushLanes.get(scheduler);

  return (
    lane ||
      flushLanes.set(
        scheduler,
        (lane = {
          _scheduler: scheduler,
          _beforeFlushHooks: [],
          _canScheduleFlush: true,
          _patchByControl: new Map(),
          _pendingControlLevels: [],
          _minPendingLevel: Infinity,
          _maxPendingLevel: 0,
          _silent: false,
        })
      ),
    lane
  );
};

export const addListener = <T extends Function>(
  internals: Listeners<T>,
  listener: T
) => {
  const listeners = internals._listeners;

  if (listeners != iteratedListeners) {
    const indexMap = internals._indexMap;

    if (indexMap) {
      if (!indexMap.has(listener)) {
        indexMap.set(listener, listeners.length);

        listeners.push(listener);
      }
    } else {
      internals._indexMap = new Map().set(listener, 0);

      (internals as Mutable<typeof internals>)._listeners = [listener];
    }
  } else {
    deferredListenerChanges.push(addListener, internals, listener);
  }
};

export const removeListener = <T extends Function>(
  internals: Listeners<T>,
  listener: T
) => {
  const listeners = internals._listeners;

  if (listeners != iteratedListeners) {
    const indexMap = internals._indexMap!;

    if (indexMap.has(listener)) {
      const last = listeners.pop()!;

      if (last != listener) {
        const index = indexMap.get(listener)!;

        listeners[index] = last;

        indexMap.set(last, index)!;
      }

      indexMap.delete(listener);
    }
  } else {
    deferredListenerChanges.push(removeListener, internals, listener);
  }
};
