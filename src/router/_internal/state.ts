import noop from 'lodash.noop';

import type { Lane, Mutable, PendingItem } from '#internal/types';
import type { RouterPatch, RouterPendingItem } from '#router/internal/types';
import queueRouterPatch from '#router/internal/queueRouterPatch';

/**
 * The app has exactly one router, so its cross-module pieces live here as
 * globals — `createRouter` wires them up (it only runs again on dev hot
 * reload).
 */

/**
 * Level-0 queue node applying a lane's pending router patch. `setValue`/`replaceValue`
 * accumulates a patch per lane, so every scheduler commits its own batch; a
 * navigation always lands in the microtask lane (the last call wins), drops
 * every accumulated update patch and gates new updates until it commits.
 */
export const paramsHandler: RouterPendingItem = {
  _level: 0,
  _updateLanes: [],
  _hasNavigation: false,
  _commitSet: noop,
};

/** The lane's pending router patch — created, queued and tracked on first use. */
export const getRouterPatch = (lane: Lane) => {
  let patch = lane._patchByControl.get(paramsHandler) as
    | RouterPatch
    | undefined;

  if (!patch) {
    queueRouterPatch(
      lane,
      (patch = {
        _navigation: undefined,
        _paramUpdates: [],
        _replace: true,
        _toAnchor: false,
      })
    );

    paramsHandler._updateLanes.push(lane);
  }

  return patch;
};

/**
 * Drops every lane's accumulated `setValue`/`replaceValue` patch — a navigation or a
 * history event supersedes them; the lanes' stale queue entries commit as
 * patchless no-ops.
 */
export const clearUpdateLanes = () => {
  const lanes = paramsHandler._updateLanes;

  for (let i = 0; i < lanes.length; i++) {
    lanes[i]._patchByControl.delete(paramsHandler);
  }

  lanes.length = 0;
};

/**
 * Queue node one level above every param control: syncs the URL from the
 * committed values — async params queue it from their mapper so every param
 * flow finalizes the same way.
 */
export const updateFinalizer: Mutable<PendingItem> = {
  _level: 0,
  _commitSet: noop,
};
