import noop from '#internal/noop';

import type { Lane, Mutable, PendingItem } from '#internal/types';
import type {
  RouteData,
  RouterControlRoot,
  RouterPatch,
  RouterHandler,
} from '#router/internal/types';
import queueRouterPatch from '#router/internal/queueRouterPatch';
import { getLane, scheduleFlush } from '#internal/flushQueue';
import scheduleMicrotask from '#internal/scheduleMicrotask';

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

/** Unmatched routes whose params `createRouterView` clears once their page unmounts. */
export const pendingParamClears: RouteData[] = [];

/**
 * `useEffect` setup whose unmount cleanup clears the queued unmatched routes'
 * params (skipping any that re-matched) — run per page so it fires only once
 * the page's controls have detached.
 */
export const clearParamsOnUnmount = () => () => {
  const l = pendingParamClears.length;

  if (l) {
    let clearLane: Lane | undefined;

    for (let i = 0; i < l; i++) {
      const route = pendingParamClears[i];

      if (!route._isMatched._value) {
        (route._params as RouterControlRoot)._set!(
          undefined,
          (clearLane ||= getLane(scheduleMicrotask))
        );
      }
    }

    pendingParamClears.length = 0;

    if (clearLane) {
      scheduleFlush(clearLane);
    }
  }
};
