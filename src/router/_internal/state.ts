import noop from '#internal/noop';

import type { Lane, Mutable, PendingItem } from '#internal/types';
import type { RouterPatch, RouterHandler } from '#router/internal/types';
import queueRouterPatch from '#router/internal/queueRouterPatch';

export const paramsHandler: RouterHandler = {
  _level: 0,
  _lanes: [],
  _hasNavigation: false,
  _commitSet: noop,
};

export const getRouterPatch = (lane: Lane) => {
  let patch = lane._patchByControl.get(paramsHandler) as
    RouterPatch | undefined;

  if (!patch) {
    queueRouterPatch(
      lane,
      (patch = {
        _navigation: undefined,
        _updates: [],
        _replace: true,
        _hashChanged: false,
      })
    );

    paramsHandler._lanes.push(lane);
  }

  return patch;
};

export const clearWrites = () => {
  const lanes = paramsHandler._lanes;

  for (let i = 0; i < lanes.length; i++) {
    lanes[i]._patchByControl.delete(paramsHandler);
  }

  lanes.length = 0;
};

export const urlFinalizer: Mutable<PendingItem> = {
  _level: 0,
  _commitSet: noop,
};

/**
 * True only while `replaceValue`'s enqueue runs; the router turns such
 * writes into history replaces.
 */
export const replacing = { _value: false };
