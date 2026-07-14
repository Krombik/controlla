import type { RouterControlRoot, RouterPatch } from '#router/internal/types';
import type { ReadonlyAsyncControl, ReadonlyControl, Scheduler } from '#types';
import { INTERNALS } from '#internal/constants';
import { getSchedulerLane, scheduleFlush } from '#internal/flushQueue';
import queueRouterPatch from '#router/internal/queueRouterPatch';
import { paramsHandler } from '#router/internal/state';

const updateParams: {
  /**
   * Updates a matched route through one of its controls — the params control
   * (from `selectParams`, a full params object or an updater receiving the
   * current value, like `setValue`) or the anchor control (from
   * `selectAnchor`, an id or `null` to clear) — committing the control and
   * syncing the URL in one flush.
   *
   * Updates batch per flush; a `navigate` in the same flush wins over all of
   * them. Pushes a history entry unless every update in the flush passed
   * {@link replace}. A custom {@link scheduler} batches the commit and the
   * URL write.
   *
   * Throws if the control's route isn't matched.
   *
   * @example
   * ```ts
   * updateParams(selectParams(router.routes.search), (prev) => ({ ...prev, sorting }));
   *
   * updateParams(selectAnchor(router.routes.search), 'results');
   * ```
   */
  <C extends ReadonlyControl>(
    params: C,
    value: C extends ReadonlyControl<infer K>
      ?
          | K
          | ((
              prevValue:
                | K
                | (C extends ReadonlyAsyncControl ? undefined : never)
            ) => K)
      : never,
    replace?: boolean,
    scheduler?: Scheduler
  ): void;
} = (control, value, replace, scheduler) => {
  const root = control[INTERNALS]._root as RouterControlRoot;

  const route = root._route;

  if (!route) {
    throw new Error('updateParams: not a router control');
  }

  if (!route._isMatched._value) {
    throw new Error('updateParams: the route is not matched');
  }

  // a pending navigate wins — updates until it commits are ignored
  if (paramsHandler._hasNavigation) {
    return;
  }

  const lane = getSchedulerLane(scheduler);

  // updates accumulate per lane, so every scheduler commits its own batch
  let patch = lane._patchByControl.get(paramsHandler) as
    | RouterPatch
    | undefined;

  if (!patch) {
    queueRouterPatch(
      lane,
      paramsHandler,
      (patch = {
        _navigation: undefined,
        _paramUpdates: [],
        _replace: true,
        _hash: undefined,
      })
    );

    paramsHandler._updateLanes.push(lane);
  }

  // the control is either the route's params control or its anchor
  if (root != route._params) {
    patch._hash = value;
  } else {
    patch._paramUpdates.push({ _route: route, _params: value });
  }

  // replace only if every update in the patch asked for it
  patch._replace &&= !!replace;

  scheduleFlush(lane);
};

export default updateParams;
