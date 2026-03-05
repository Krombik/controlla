import type { Lane } from '#internal/types';
import type { Scheduler } from '#types';

let currentLane: Lane | null = null;

const flushLanes = new WeakMap<Scheduler, Lane>();

export const scheduleFlush = (lane: Lane, scheduler: Scheduler) => {
  if (lane._canScheduleFlush) {
    lane._canScheduleFlush = false;

    scheduler(() => {
      const {
        _pendingControls: pendingControls,
        _afterFlushHooks: afterFlushHooks,
        _patchByControl: patchByControl,
      } = lane;

      do {
        currentLane = lane;

        for (let i = 0; i < pendingControls.length; i++) {
          const control = pendingControls[i];

          control._commitSet(patchByControl.get(control)!);
        }

        pendingControls.length = 0;

        currentLane = null;

        patchByControl.clear();

        for (let i = 0; i < afterFlushHooks.length; i++) {
          afterFlushHooks[i]();
        }

        afterFlushHooks.length = 0;
      } while (pendingControls.length);

      lane._canScheduleFlush = true;
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
    _afterFlushHooks: [],
    _canScheduleFlush: true,
    _patchByControl: new Map(),
    _pendingControls: [],
  };

  flushLanes.set(scheduler, newLane);

  return newLane;
};
