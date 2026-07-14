import type {
  Hash,
  ResolvedParamUpdate,
  RouteMethods,
  RouterParamUpdates,
} from '#router/internal/types';
import { getSchedulerLane, scheduleFlush } from '#internal/flushQueue';
import { EMPTY_ARR } from '#internal/constants';
import queueRouterPatch from '#router/internal/queueRouterPatch';
import {
  clearNavigation,
  clearUpdateLanes,
  paramsHandler,
} from '#router/internal/state';

/**
 * Navigates to the target described by {@link methods} — resolves the param
 * updates, stores the payload in the lane and queues the router's params
 * handler; kept out of `createRouter` so only `navigate`/`useLink` consumers
 * pay for it.
 */
const navigateRoute = (
  methods: RouteMethods,
  params: RouterParamUpdates[] | undefined,
  replace: boolean | undefined,
  ignoreBlock: boolean | undefined,
  enableScrollToTop: boolean | undefined,
  enableScrollRestoration: boolean | undefined,
  hash?: Hash
) => {
  const routes = methods._routes();

  const routesCount = routes.length;

  const updatesCount = params ? params.length : 0;

  const updates: ResolvedParamUpdate[] = [];

  let u = 0;

  // one pass, following the chain order: resolve the passed updates against
  // the committed values and snapshot every other matched param route — the
  // navigation applies as captured at call time, whatever happens to the
  // controls before the commit
  for (let i = 0; i < routesCount; i++) {
    const route = routes[i];

    const paramsRoot = route._params;

    if (paramsRoot) {
      const item = u < updatesCount ? params![u] : undefined;

      if (item && item._route == route) {
        u++;

        const { _params } = item;

        updates.push(
          typeof _params == 'function'
            ? { _route: route, _params: _params(paramsRoot._value) }
            : item
        );
      } else if (route._isMatched._value) {
        const value = paramsRoot._value;

        // undefined = async params not parsed yet — nothing to capture
        if (value !== undefined) {
          updates.push({ _route: route, _params: value });
        }
      } else {
        throw new Error('navigate: params are required for an unmatched route');
      }
    }
  }

  // an unconsumed entry targets a route outside the resolved chain
  if (u != updatesCount) {
    throw new Error('navigate: params were passed for an unmatched route');
  }

  const lane = getSchedulerLane();

  // a navigation supersedes everything accumulated — drop every lane's
  // updates and a navigation pending in another lane (the last call wins),
  // and gate new updates until the commit; the blocker is checked at commit
  // — the params handler parks the patch if needed
  clearUpdateLanes();

  clearNavigation();

  paramsHandler._navLane = lane;

  paramsHandler._hasNavigation = true;

  queueRouterPatch(lane, paramsHandler, {
    _navigation: {
      _updates: updates,
      _methods: methods,
      _isNewPage: false,
      _isHistoryEvent: false,
      _ignoreBlock: ignoreBlock,
      _enableScrollToTop: enableScrollToTop,
      _enableScrollRestoration: enableScrollRestoration,
    },
    _paramUpdates: EMPTY_ARR,
    _replace: !!replace,
    _hash: hash,
  });

  scheduleFlush(lane);
};

export default navigateRoute;
