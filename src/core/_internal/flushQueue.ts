import type {
  ChangeListener,
  Lane,
  Listeners,
  Mutable,
  Notifier,
} from '#internal/types';
import type { Scheduler } from '#types';
import scheduleMicrotask from '#internal/scheduleMicrotask';

let currentLane: Lane | null = null;

/** Listener add/remove during notify is deferred to keep the iterated array stable. */
const NOT_ITERATED: readonly Function[] = [];

let iteratedListeners = NOT_ITERATED;

const deferredListenerChanges: any[] = [];

export const notify = (
  listeners: ChangeListener[],
  dependents: Notifier[],
  lane: Lane,
  value: any,
  prevValue: any
) => {
  const listenersCount = listeners.length;

  if (listenersCount) {
    iteratedListeners = listeners;

    try {
      for (let i = 0; i < listenersCount; i++) {
        listeners[i](value, prevValue);
      }
    } finally {
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
  }

  let l = dependents.length;

  // GC'd dependents are compacted in place via swap-pop
  if (l) {
    for (let i = 0, item = dependents[0]; ; ) {
      const control = item._ref.deref();

      if (control) {
        item._notify(lane, control, value, prevValue);

        if (++i == l) {
          return;
        }

        item = dependents[i];
      } else {
        item = dependents.pop()!;

        if (i == --l) {
          return;
        }
      }
    }
  }
};

const flushLanes = new WeakMap<Scheduler, Lane>();

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

export const scheduleFlush = (lane: Lane) => {
  const scheduler = lane._scheduler;

  if (lane._canScheduleFlush) {
    lane._canScheduleFlush = false;

    scheduler(() => {
      const { _beforeFlushHooks: beforeFlushHooks } = lane;

      currentLane = lane;

      try {
        for (let i = 0; i < beforeFlushHooks.length; i++) {
          beforeFlushHooks[i]();
        }

        flushQueue(lane, lane._pendingControlLevels, lane._patchByControl);
      } catch (err) {
        lane._patchByControl.clear();

        lane._pendingControlLevels.length = 0;

        throw err;
      } finally {
        currentLane = null;

        beforeFlushHooks.length = 0;

        lane._minPendingLevel = Infinity;

        lane._maxPendingLevel = 0;

        lane._canScheduleFlush = true;
      }
    });
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
