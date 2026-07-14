import type {
  Hash,
  RouterWrite,
  RouteMethods,
  TargetParams,
} from '#router/internal/types';
import { getSchedulerLane, scheduleFlush } from '#internal/flushQueue';
import queueRouterPatch from '#router/internal/queueRouterPatch';
import { clearWrites, paramsHandler } from '#router/internal/state';

const navigateRoute = (
  methods: RouteMethods,
  params: TargetParams[] | undefined,
  hash: Hash | undefined,
  replace: boolean,
  ignoreBlock: boolean | undefined,
  enableScrollToTop: boolean | undefined,
  enableScrollRestoration: boolean | undefined
) => {
  const routes = methods._routes();

  const routesCount = routes.length;

  const updatesCount = params ? params.length : 0;

  const updates: RouterWrite[] = [];

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

  clearWrites();

  paramsHandler._hasNavigation = true;

  queueRouterPatch(lane, {
    _navigation: {
      _methods: methods,
      _isNewPage: false,
      _isHistoryEvent: false,
      _ignoreBlock: ignoreBlock,
      _scrollToTop: enableScrollToTop,
      _scrollRestoration: enableScrollRestoration,
    },
    _updates: updates,
    _replace: replace,
    _hashChanged: toAnchor,
  });

  scheduleFlush(lane);
};

export default navigateRoute;
