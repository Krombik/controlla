import type { Lane, Listeners, Mutable } from '#internal/types';
import type { Scheduler } from '#types';

let currentLane: Lane | null = null;

const deferredListenerChanges: {
  readonly _listeners: Listeners<Function>;
  readonly _listener: Function;
  readonly _shouldExist: boolean;
}[] = [];

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

        if (lane._minPendingLevel < level) {
          flushQueue(lane, pendingControlLevels, patchByControl, level);
        }
      }

      pendingInternals.length = 0;
    }
  }
};

export const scheduleFlush = (lane: Lane, scheduler: Scheduler) => {
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

        const l = deferredListenerChanges.length;

        if (l) {
          for (let i = 0; i < l; i++) {
            const item = deferredListenerChanges[i];

            (item._shouldExist ? addListener : removeListener)(
              item._listeners,
              item._listener
            );
          }

          deferredListenerChanges.length = 0;
        }
      }
    });
  }
};

export const getCurrentLane = () => currentLane;

export const getLane = (scheduler: Scheduler) => {
  const lane = flushLanes.get(scheduler);

  if (lane) {
    return lane;
  }

  const newLane: Lane = {
    _beforeFlushHooks: [],
    _canScheduleFlush: true,
    _patchByControl: new Map(),
    _pendingControlLevels: [],
    _minPendingLevel: Infinity,
    _maxPendingLevel: 0,
  };

  flushLanes.set(scheduler, newLane);

  return newLane;
};

export const addListener = <T extends Function>(
  internals: Listeners<T>,
  listener: T
) => {
  if (!currentLane) {
    const indexMap = internals._indexMap;

    if (indexMap) {
      if (!indexMap.has(listener)) {
        const listeners = internals._listeners;

        indexMap.set(listener, listeners.length);

        listeners.push(listener);
      }
    } else {
      internals._indexMap = new Map().set(listener, 0);

      (internals as Mutable<typeof internals>)._listeners = [listener];
    }
  } else {
    deferredListenerChanges.push({
      _shouldExist: true,
      _listeners: internals,
      _listener: listener,
    });
  }
};

export const removeListener = <T extends Function>(
  internals: Listeners<T>,
  listener: T
) => {
  if (!currentLane) {
    const indexMap = internals._indexMap!;

    if (indexMap.has(listener)) {
      const listeners = internals._listeners;

      const last = listeners.pop()!;

      if (last != listener) {
        const index = indexMap.get(listener)!;

        listeners[index] = last;

        indexMap.set(last, index)!;
      }

      indexMap.delete(listener);
    }
  } else {
    deferredListenerChanges.push({
      _shouldExist: false,
      _listeners: internals,
      _listener: listener,
    });
  }
};
