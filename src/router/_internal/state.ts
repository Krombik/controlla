import noop from 'lodash.noop';

import type { Lane, Mutable, PendingItem } from '#internal/types';
import type { RouterPatch, RouterPendingItem } from '#router/internal/types';
import queueRouterPatch from '#router/internal/queueRouterPatch';

export const paramsHandler: RouterPendingItem = {
  _level: 0,
  _updateLanes: [],
  _hasNavigation: false,
  _commitSet: noop,
};

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

export const clearUpdateLanes = () => {
  const lanes = paramsHandler._updateLanes;

  for (let i = 0; i < lanes.length; i++) {
    lanes[i]._patchByControl.delete(paramsHandler);
  }

  lanes.length = 0;
};

export const updateFinalizer: Mutable<PendingItem> = {
  _level: 0,
  _commitSet: noop,
};
