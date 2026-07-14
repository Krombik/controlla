import type {
  Hash,
  RouterUpdateEntry,
  RouteMethods,
  RouterParamUpdates,
} from '#router/internal/types';
import { getSchedulerLane, scheduleFlush } from '#internal/flushQueue';
import queueRouterPatch from '#router/internal/queueRouterPatch';
import { clearUpdateLanes, paramsHandler } from '#router/internal/state';

/**
 * Navigates to the target described by {@link methods} — resolves the param
 * updates, stores the payload in the lane and queues the router's params
 * handler; kept out of `createRouter` so only `navigate`/`useLink` consumers
 * pay for it.
 */
const navigateRoute = (
  methods: RouteMethods,
  params: RouterParamUpdates[] | undefined,
  hash: Hash | undefined,
  replace: boolean,
  ignoreBlock: boolean | undefined,
  enableScrollToTop: boolean | undefined,
  enableScrollRestoration: boolean | undefined
) => {
  const routes = methods._routes();

  const routesCount = routes.length;

  const updatesCount = params ? params.length : 0;

  const updates: RouterUpdateEntry[] = [];

  const toAnchor = hash !== undefined;

  let u = 0;

  let route;

  for (let i = 0; i < routesCount; i++) {
    route = routes[i];

    const paramsRoot = route._params;

    if (paramsRoot) {
      const item = u < updatesCount ? params![u] : undefined;

      if (item && item._route == route) {
        u++;

        const { _params } = item;

        updates.push({
          _root: paramsRoot,
          _params:
            typeof _params == 'function' ? _params(paramsRoot._value) : _params,
          _path: undefined,
        });
      } else if (!route._isMatched._value) {
        throw new Error('navigate: params are required for an unmatched route');
      }
    }
  }

  if (u != updatesCount) {
    throw new Error('navigate: params were passed for an unmatched route');
  }

  if (toAnchor) {
    const root = route!._anchor!._hash;

    updates.push({
      _root: root,
      _params: typeof hash == 'function' ? hash(root._value) : hash,
      _path: undefined,
    });
  }

  const lane = getSchedulerLane();

  clearUpdateLanes();

  paramsHandler._hasNavigation = true;

  queueRouterPatch(lane, {
    _navigation: {
      _methods: methods,
      _isNewPage: false,
      _isHistoryEvent: false,
      _ignoreBlock: ignoreBlock,
      _enableScrollToTop: enableScrollToTop,
      _enableScrollRestoration: enableScrollRestoration,
    },
    _paramUpdates: updates,
    _replace: replace,
    _toAnchor: toAnchor,
  });

  scheduleFlush(lane);
};

export default navigateRoute;
