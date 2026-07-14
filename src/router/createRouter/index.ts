import type {
  ProcessParams,
  Hash,
  Navigation,
  ResolvedParamUpdate,
  RouteData,
  RouteMethods,
  RouterControlRoot,
  RouterPatch,
  Router,
  NavigationState,
  Route,
  AnyPaths,
  HandleParse,
} from '#router/internal/types';

import noop from 'lodash.noop';

import {
  ROUTE_METHODS,
  ROUTE_PARAMS,
  ROUTE_HASH,
  EMPTY_OBJECT,
} from '#router/internal/constants';
import makePrimitiveInternals from '#internal/makePrimitiveInternals';
import append from '#internal/append';

import NOT_FOUND from '#router/NOT_FOUND';
import { INTERNALS, EMPTY_ARR } from '#internal/constants';
import { getLane, getSchedulerLane, scheduleFlush } from '#internal/flushQueue';
import addToQueue from '#internal/addToQueue';
import type { AsyncControlScope, ControlScope } from '#types';
import type {
  AsyncControlInternals,
  ControlInternals,
  Mutable,
} from '#internal/types';
import type { NavigationTarget } from '#router/types';
import createManualScheduler from '#scheduler/createManualScheduler';
import parseSearch from '#router/internal/parseSearch';
import addToLevel from '#internal/addToLevel';
import {
  clearNavigation,
  clearUpdateLanes,
  paramsHandler,
  updateFinalizer,
} from '#router/internal/state';
import queueRouterPatch from '#router/internal/queueRouterPatch';
import enqueue from '#internal/enqueue';

type HistoryState = {
  idx?: number;
  scroll?: [x: number, y: number];
};

let devPopStateListener: undefined | ((e: PopStateEvent) => void);

const beforeUnloadListener = (e: BeforeUnloadEvent) => {
  e.preventDefault();

  e.returnValue = true;
};

const createRouter = <Paths extends AnyPaths>(paths: Paths): Router<Paths> => {
  // the router is a singleton — a second call happens only on dev hot reload
  if (process.env.NODE_ENV !== 'production') {
    if (devPopStateListener) {
      window.removeEventListener('popstate', devPopStateListener);
    }

    clearUpdateLanes();

    clearNavigation();
  }

  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  const routesQueue: RouteData[][] = [];

  const findCurrentRouteArr: Array<
    (path: string, searchParams: Record<string, string>) => boolean
  > = [];

  let currentRouteIndex = -1;

  let maxLinkSlots = 0;

  const asyncStrings: Record<string, string | undefined> = {};

  const storeAsyncString = (key: string, value: string | undefined) => {
    asyncStrings[key] = value;
  };

  const getMaxLinkSlots = () => maxLinkSlots;

  const currentChainMethods: RouteMethods = {
    _routes: () => routesQueue[currentRouteIndex],
    _maxSlots: getMaxLinkSlots,
    _index: -1,
    _setComponents: noop,
  };

  const historyEventScheduler = createManualScheduler();

  const historyLane = getLane(historyEventScheduler);

  /** Runs the route matching for the current URL and flushes it right away. */
  const runHistoryMatching = (
    pathname: string,
    searchParams: Record<string, string>
  ) => {
    for (
      let i = 0;
      i < findCurrentRouteArr.length &&
      findCurrentRouteArr[i](pathname, searchParams);
      i++
    ) {}

    scheduleFlush(historyLane);

    historyEventScheduler.flush();
  };

  const makeExtract = (keys: string[], parsers: Record<string, HandleParse>) =>
    keys.length
      ? (
          target: Record<string, any>,
          stringifiedParams: Record<string, string | undefined>,
          source: any
        ) => {
          for (let i = 0; i < keys.length; i++) {
            const key = keys[i];

            parsers[key](
              target,
              key,
              stringifiedParams[key] || undefined,
              source
            );
          }
        }
      : noop;

  paramsHandler._commitSet = (patch: RouterPatch | undefined, lane) => {
    // no patch = the lane's updates were dropped by a later navigation
    if (!patch) {
      return;
    }

    const nav = patch._navigation;

    if (nav) {
      paramsHandler._hasNavigation = false;

      paramsHandler._navLane = undefined;

      if (!isRouterAvailable && !nav._ignoreBlock && !nav._isHistoryEvent) {
        nav._ignoreBlock = true;

        allowNavigate = () => {
          const nextLane = getSchedulerLane();

          // the re-dispatch is a new navigation — updates accumulated while
          // parked die the same way
          clearUpdateLanes();

          paramsHandler._navLane = nextLane;

          paramsHandler._hasNavigation = true;

          queueRouterPatch(nextLane, paramsHandler, patch);

          scheduleFlush(nextLane);
        };

        isLeaveControl._enqueueSet(true, lane);

        return;
      }

      const methods = nav._methods;

      const nextRoutes = methods._routes();

      const nextAnchor = nextRoutes[nextRoutes.length - 1]._anchor;

      if (currentRouteIndex < 0) {
        for (let i = 0; i < nextRoutes.length; i++) {
          nextRoutes[i]._isMatched._value = true;
        }

        if (nextAnchor) {
          nextAnchor._activate();
        }

        currentRouteIndex = methods._index;
      } else {
        const currentRoutes = routesQueue[currentRouteIndex];

        if (currentRoutes != nextRoutes) {
          nav._isNewPage = true;

          const prevAnchor = currentRoutes[currentRoutes.length - 1]._anchor;

          if (prevAnchor) {
            prevAnchor._clear(lane);
          }

          if (nextAnchor) {
            nextAnchor._activate();
          }

          const maxLength = Math.max(nextRoutes.length, currentRoutes.length);

          for (let i = 0; i < maxLength; i++) {
            const currRoute = currentRoutes[i];

            const nextRoute = nextRoutes[i];

            if (currRoute != nextRoute) {
              if (nextRoute) {
                nextRoute._isMatched._enqueueSet(true, lane);
              }

              if (currRoute) {
                currRoute._isMatched._enqueueSet(false, lane);

                const params = currRoute._params;

                if (params) {
                  params._enqueueSet(undefined, lane);
                }
              }
            }
          }

          currentRouteIndex = methods._index;
        }
      }

      const updates = nav._updates;

      for (let i = 0; i < updates.length; i++) {
        const item = updates[i];

        item._route._params!._enqueueSet(item._params, lane);
      }

      methods._setComponents();
    } else {
      // this lane's accumulated updates commit now — unregister it
      const lanes = paramsHandler._updateLanes;

      const index = lanes.indexOf(lane);

      if (~index) {
        lanes[index] = lanes[lanes.length - 1];

        lanes.pop();
      }

      const queue = patch._paramUpdates;

      for (let i = 0; i < queue.length; i++) {
        const { _route, _params } = queue[i];

        if (_route._isMatched._value) {
          _route._params!._enqueueSet(
            typeof _params == 'function'
              ? _params(_route._params!._value)
              : _params,
            lane
          );
        }
      }
    }

    if (!lane._patchByControl.has(updateFinalizer)) {
      addToLevel(lane, updateFinalizer);
    }

    lane._patchByControl.set(updateFinalizer, patch);
  };

  updateFinalizer._commitSet = (patch: RouterPatch | null, lane) => {
    const nav = patch && patch._navigation;

    const routes = routesQueue[currentRouteIndex];

    let path = '';

    let search = '';

    for (let i = 0; i < routes.length; i++) {
      const route = routes[i];

      const paramsRoot = route._params;

      if (paramsRoot && route._isMatched._value) {
        const value = paramsRoot._value;

        if (value !== undefined) {
          route._handlePath(value, true, false);

          route._handleSearch(value, true, false);
        }
      }

      path += route._currentPath;

      const currentSearch = route._currentSearch;

      if (currentSearch) {
        if (search) {
          search += '&' + currentSearch;
        } else {
          search = '?' + currentSearch;
        }
      }
    }

    const anchorParam = routes[routes.length - 1]._anchor;

    const rawHash = patch ? patch._hash : undefined;

    let anchorValue: string = anchorParam ? anchorParam._hash._value : '';

    let scrollToAnchor = false;

    if (rawHash !== undefined) {
      anchorValue =
        typeof rawHash == 'function' ? rawHash(anchorValue) : rawHash;

      scrollToAnchor = !!anchorValue;

      if (anchorParam) {
        anchorParam._hash._enqueueSet(anchorValue, lane);
      }
    }

    const replace = !patch || patch._replace;

    const href = (path || '/') + search + (anchorValue && '#' + anchorValue);

    if (href != location.pathname + location.search + location.hash) {
      const state = history.state;

      if (replace) {
        history.replaceState(state, '', href);

        if (!nav || !nav._isHistoryEvent) {
          navigationStateRoot._enqueueSet(
            { action: 'replace', delta: 0 },
            lane
          );
        }
      } else {
        if (
          nav &&
          (nav._enableScrollRestoration == null
            ? nav._isNewPage
            : nav._enableScrollRestoration)
        ) {
          history.replaceState(
            {
              ...state,
              scroll: [window.scrollX, window.scrollY],
            } satisfies HistoryState,
            ''
          );
        }

        history.pushState(
          {
            ...state,
            idx: ++currentHistoryIndex,
          } satisfies HistoryState,
          '',
          href
        );

        navigationStateRoot._enqueueSet({ action: 'push', delta: 1 }, lane);
      }
    }

    if (scrollToAnchor && anchorParam) {
      anchorParam._scrollTo(anchorValue);
    } else if (
      nav &&
      (nav._enableScrollToTop == null ? nav._isNewPage : nav._enableScrollToTop)
    ) {
      window.scroll(0, 0);
    }
  };

  let maxParamControlLevel = 0;

  const handleRoutes = (
    routes: Route<any, any, any>,
    navigations: Record<string, Navigation<AnyPaths, any>>,
    paths: AnyPaths,
    data: RouteData[],
    parentRegexStr: string,
    paramsCount: number,
    withPathParams: boolean
  ) => {
    const keys: Array<string | symbol> = Object.keys(paths);

    if (NOT_FOUND in paths) {
      keys.push(NOT_FOUND);
    }

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i] as string;

      const {
        _children,
        _parsers,
        _stringifies,
        _path,
        _pathParams,
        _queryParams,
        _regexStr,
        _anchor,
        _source,
        _createControlScope,
      } = paths[key];

      const pathParamsCount = _pathParams.length;

      const queryParamsCount = _queryParams.length;

      const l = _path.length;

      const isMatchedRoot = makePrimitiveInternals(false);

      const regexStr =
        parentRegexStr + (pathParamsCount ? `(${_regexStr})` : _regexStr);

      const storeString = _source ? storeAsyncString : noop;

      const routeData: RouteData = {
        _currentPath: pathParamsCount || !l ? '' : _path[0],
        _currentSearch: '',
        _handlePath: pathParamsCount
          ? (params, typed, peek) => {
              // `peek` is constant per call — pick the store once, keep the
              // loop branch-free (a real store only exists on async routes)
              const store = peek ? noop : storeString;

              let str = '';

              for (let i = 0; i < l; i++) {
                const item = _path[i];

                if (item[0] == '/') {
                  str += item;
                } else {
                  const param = params[item];

                  const value = typed
                    ? _stringifies[item](param !== '' ? param : undefined, item)
                    : param || undefined;

                  store(item, value);

                  if (value !== undefined) {
                    str += '/' + value;
                  }
                }
              }

              if (peek) {
                return str;
              }

              (routeData as Mutable<RouteData>)._currentPath = str;
            }
          : (noop as any),
        _handleSearch: queryParamsCount
          ? (params, typed, peek) => {
              const store = peek ? noop : storeString;

              let search = '';

              for (let i = 0; i < queryParamsCount; i++) {
                const name = _queryParams[i];

                const param = params[name];

                const value = typed
                  ? _stringifies[name](param !== '' ? param : undefined, name)
                  : param || undefined;

                store(name, value);

                if (value !== undefined) {
                  if (search) {
                    search += `&${name}=${encodeURIComponent(value)}`;
                  } else {
                    search = `${name}=${encodeURIComponent(value)}`;
                  }
                }
              }

              if (peek) {
                return search;
              }

              (routeData as Mutable<RouteData>)._currentSearch = search;
            }
          : (noop as any),
        _extractPathParams: makeExtract(_pathParams, _parsers),
        _extractQueryParams: makeExtract(_queryParams, _parsers),
        _isMatched: isMatchedRoot,
        _anchor: _anchor,
        _params: null,
      };

      withPathParams ||= !!pathParamsCount;

      const routesData = append(data, routeData);

      let paramsRoot: AsyncControlInternals | ControlInternals | null = null;

      let paramsControl: ControlScope | AsyncControlScope | undefined;

      if (pathParamsCount || queryParamsCount) {
        paramsControl = _createControlScope(
          isMatchedRoot,
          _source!,
          routeData,
          asyncStrings!
        );

        (routeData as Mutable<RouteData>)._params = paramsRoot = paramsControl[
          INTERNALS
        ] as ControlInternals | AsyncControlInternals;

        (paramsRoot as RouterControlRoot)._route = routeData;

        if (paramsRoot._level > maxParamControlLevel) {
          maxParamControlLevel = paramsRoot._level;
        }
      }

      if (_anchor) {
        (_anchor._hash as RouterControlRoot)._route = routeData;
      }

      let _paramsCount = paramsCount;

      let navigation: (
        this: NavigationTarget<boolean>,
        params?: ProcessParams<Record<string, any>> | Hash,
        hash?: Hash
      ) => NavigationTarget<boolean>;

      const route = {
        [INTERNALS]: isMatchedRoot,
        [ROUTE_PARAMS]: paramsControl,
      } as unknown as Route<any, any, any>;

      if (pathParamsCount || queryParamsCount) {
        _paramsCount++;
      }

      if (_children) {
        const childrenNavigation = {};

        handleRoutes(
          route,
          childrenNavigation,
          _children,
          routesData,
          regexStr,
          _paramsCount,
          withPathParams
        );

        if (paramsControl) {
          navigation = function (params) {
            return (
              params !== undefined
                ? {
                    ...childrenNavigation,
                    [ROUTE_METHODS]: currentChainMethods,
                    [ROUTE_PARAMS]:
                      ROUTE_PARAMS in this
                        ? append(this[ROUTE_PARAMS]!, {
                            _params: params,
                            _route: routeData,
                          })
                        : [
                            {
                              _params: params,
                              _route: routeData,
                            },
                          ],
                  }
                : ROUTE_PARAMS in this
                  ? {
                      ...childrenNavigation,
                      [ROUTE_PARAMS]: this[ROUTE_PARAMS],
                    }
                  : childrenNavigation
            ) as NavigationTarget<boolean>;
          };
        } else {
          navigation = function () {
            return (
              ROUTE_PARAMS in this
                ? {
                    ...childrenNavigation,
                    [ROUTE_PARAMS]: this[ROUTE_PARAMS]!,
                  }
                : childrenNavigation
            ) as NavigationTarget<boolean>;
          };
        }
      } else {
        const regex = new RegExp(`^${regexStr || '/'}$`);

        const testRegex = regex[withPathParams ? 'exec' : 'test'].bind(regex);

        const routeIndex = routesQueue.length;

        const methods: RouteMethods = {
          _routes: () => routesData,
          _maxSlots: getMaxLinkSlots,
          _index: routeIndex,
          _setComponents: noop,
        };

        const res = {
          [ROUTE_METHODS]: methods,
        } as NavigationTarget<boolean>;

        route._register = (setComponents) => {
          if (currentRouteIndex == routeIndex) {
            setComponents();
          }

          methods._setComponents = setComponents;
        };

        (route as Mutable<typeof route>)._anchor = _anchor;

        navigation = paramsControl
          ? function (params, hash) {
              return (
                params !== undefined
                  ? {
                      [ROUTE_METHODS]: methods,
                      [ROUTE_HASH]: hash,
                      [ROUTE_PARAMS]:
                        ROUTE_PARAMS in this
                          ? append(this[ROUTE_PARAMS]!, {
                              _params: params,
                              _route: routeData,
                            })
                          : [
                              {
                                _params: params,
                                _route: routeData,
                              },
                            ],
                    }
                  : ROUTE_PARAMS in this
                    ? {
                        [ROUTE_METHODS]: methods,
                        [ROUTE_PARAMS]: this[ROUTE_PARAMS],
                      }
                    : res
              ) as NavigationTarget<boolean>;
            }
          : function (hash) {
              return (
                ROUTE_PARAMS in this
                  ? {
                      [ROUTE_METHODS]: methods,
                      [ROUTE_HASH]: hash as Hash,
                      [ROUTE_PARAMS]: this[ROUTE_PARAMS]!,
                    }
                  : hash !== undefined
                    ? ({
                        [ROUTE_METHODS]: methods,
                        [ROUTE_HASH]: hash as Hash,
                      } as NavigationTarget<boolean>)
                    : res
              ) as NavigationTarget<boolean>;
            };

        if (routesData.length > maxLinkSlots) {
          maxLinkSlots = routesData.length;
        }

        routesQueue.push(routesData);

        const queueMatch = (updates: ResolvedParamUpdate[]) => {
          // the history event already happened — every pending intent dies
          clearUpdateLanes();

          clearNavigation();

          queueRouterPatch(historyLane, paramsHandler, {
            _navigation: {
              _updates: updates,
              _methods: methods,
              _isNewPage: false,
              _isHistoryEvent: true,
              _ignoreBlock: false,
              _enableScrollToTop: false,
              _enableScrollRestoration: false,
            },
            _paramUpdates: EMPTY_ARR,
            _replace: true,
            _hash: location.hash.slice(1),
          });
        };

        findCurrentRouteArr.push(
          _paramsCount
            ? (path, searchParams) => {
                const isMatched = testRegex(path);

                if (isMatched) {
                  const pathParams: Record<string, string> = withPathParams
                    ? (isMatched as RegExpExecArray).groups!
                    : EMPTY_OBJECT;

                  const updates: ResolvedParamUpdate[] = [];

                  for (let i = 0; i < routesData.length; i++) {
                    const route = routesData[i];

                    const paramsControl = route._params;

                    if (paramsControl) {
                      route._handlePath(pathParams, false, false);

                      route._handleSearch(searchParams, false, false);

                      if ('_equable' in paramsControl) {
                        paramsControl._equable = false;

                        addToQueue(historyLane, paramsControl);
                      } else {
                        const params = {};

                        try {
                          route._extractPathParams(
                            params,
                            pathParams,
                            undefined
                          );

                          route._extractQueryParams(
                            params,
                            searchParams,
                            undefined
                          );
                        } catch {
                          return true;
                        }

                        updates.push({ _route: route, _params: params });
                      }
                    }
                  }

                  queueMatch(updates);
                }

                return !isMatched;
              }
            : (path) =>
                testRegex(path) ? (queueMatch(EMPTY_ARR), false) : true
        );
      }

      (routes as any)[key] = route;

      navigations[key] = navigation as Navigation<any, any, any, any>;
    }
  };

  const isLeaveControl = makePrimitiveInternals(false);

  const navigationStateRoot = makePrimitiveInternals({
    action: 'none',
    delta: 0,
  } satisfies NavigationState);

  const navigationControlState = {
    [INTERNALS]: navigationStateRoot,
  } as unknown as Router<any>['navigationState'];

  const state = history.state as HistoryState | null;

  const navigations: Record<string, Navigation<AnyPaths, any>> = {};

  const routes: Route<any, any, any> = {} as any;

  const { search } = location;

  const searchParams = parseSearch(search);

  let { pathname } = location;

  let delta = 0;

  let isPopTriggeredByBlocking = false;

  let isRouterBlockPopupAllowed = true;

  let isPopTriggeredForScrollSave = false;

  let isPopTriggeredByScrollSaving = false;

  let currentHistoryIndex = 0;

  let isRouterAvailable = true;

  let allowNavigate: () => void = noop;

  const popStateListener = (e: PopStateEvent) => {
    const state = e.state as HistoryState | null;

    const nextHistoryIndex = state && state.idx;

    if (isPopTriggeredByBlocking) {
      isPopTriggeredByBlocking = false;

      enqueue(isLeaveControl, true);
    } else if (isPopTriggeredForScrollSave) {
      isPopTriggeredForScrollSave = false;

      isPopTriggeredByScrollSaving = true;

      history.replaceState(
        {
          ...state,
          scroll: [window.scrollX, window.scrollY],
        } satisfies HistoryState,
        ''
      );

      history.go(delta);
    } else if (nextHistoryIndex != currentHistoryIndex) {
      if (nextHistoryIndex != null) {
        const scroll = state && state.scroll;

        isPopTriggeredByBlocking =
          isRouterBlockPopupAllowed && !isRouterAvailable;

        delta = nextHistoryIndex - currentHistoryIndex;

        if (isPopTriggeredByBlocking) {
          allowNavigate = () => {
            isRouterBlockPopupAllowed = false;

            if (scroll) {
              history.replaceState(
                {
                  ...state,
                  scroll: [window.scrollX, window.scrollY],
                } satisfies HistoryState,
                ''
              );
            }

            history.go(delta);
          };

          history.go(-delta);

          return;
        }

        isPopTriggeredForScrollSave = !!scroll && !isPopTriggeredByScrollSaving;

        if (isPopTriggeredForScrollSave) {
          history.go(-delta);

          return;
        }

        if (scroll && isPopTriggeredByScrollSaving) {
          isPopTriggeredByScrollSaving = false;

          window.scroll(scroll[0], scroll[1]);

          history.replaceState({ ...state, scroll: undefined }, '');
        }

        currentHistoryIndex = nextHistoryIndex;
      } else {
        history.replaceState(
          {
            ...(state as HistoryState),
            idx: ++currentHistoryIndex,
          } satisfies HistoryState,
          ''
        );

        delta = 0;
      }

      isRouterBlockPopupAllowed = true;

      navigationStateRoot._enqueueSet({ action: 'pop', delta }, historyLane);

      runHistoryMatching(location.pathname, parseSearch(location.search));
    }
  };

  handleRoutes(routes, navigations, paths, EMPTY_ARR, '', 0, false);

  updateFinalizer._level = ++maxParamControlLevel;

  if (pathname.length > 1 && pathname.at(-1) == '/') {
    pathname = pathname.slice(0, -1);

    history.replaceState(state, '', pathname + search + location.hash);
  }

  if (!state || state.idx == null) {
    history.replaceState(
      (state && typeof state == 'object'
        ? { ...state, idx: 0 }
        : { idx: 0 }) satisfies HistoryState,
      ''
    );
  } else {
    currentHistoryIndex = state.idx;
  }

  runHistoryMatching(pathname, searchParams);

  window.addEventListener('popstate', popStateListener);

  if (process.env.NODE_ENV !== 'production') {
    devPopStateListener = popStateListener;
  }

  return {
    routes: routes as any,
    navigation: navigations as any,
    navigationState: navigationControlState,
    navigationBlocker: {
      enable() {
        isRouterAvailable = false;

        window.addEventListener('beforeunload', beforeUnloadListener);

        return this.disable;
      },
      disable() {
        isRouterAvailable = true;

        window.removeEventListener('beforeunload', beforeUnloadListener);
      },
      isPendingNavigation: {
        [INTERNALS]: isLeaveControl,
        allow() {
          enqueue(isLeaveControl, false);

          allowNavigate();

          allowNavigate = noop;
        },
        deny() {
          enqueue(isLeaveControl, false);

          allowNavigate = noop;
        },
      } as Router<any>['navigationBlocker']['isPendingNavigation'],
    },
  };
};

export default createRouter;
