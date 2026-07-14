import type {
  ProcessParams,
  Hash,
  HandleParse,
  Navigation,
  RouteData,
  RouteMethods,
  RouterControlRoot,
  RouterPatch,
  Router,
  NavigationState,
  Route,
  AnyPaths,
  RouterUpdateEntry,
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
  clearUpdateLanes,
  getRouterPatch,
  paramsHandler,
  updateFinalizer,
} from '#router/internal/state';
import replacing from '#internal/replacing';
import queueRouterPatch from '#router/internal/queueRouterPatch';
import removeFromArray from '#internal/removeFromArray';
import enqueue from '#internal/enqueue';

type HistoryState = {
  idx?: number;
  scroll?: [x: number, y: number];
  init?: 1;
};

let devPopStateListener: undefined | ((e: PopStateEvent) => void);

let devPageHideListener: undefined | (() => void);

const beforeUnloadListener = (e: BeforeUnloadEvent) => {
  e.preventDefault();

  e.returnValue = true;
};

const saveScroll = (state: HistoryState | null) => {
  history.replaceState(
    {
      ...state,
      scroll: [window.scrollX, window.scrollY],
    } satisfies HistoryState,
    ''
  );
};

const createRouter = <Paths extends AnyPaths>(paths: Paths): Router<Paths> => {
  if (process.env.NODE_ENV !== 'production') {
    if (devPopStateListener) {
      window.removeEventListener('popstate', devPopStateListener);

      window.removeEventListener('pagehide', devPageHideListener!);
    }

    clearUpdateLanes();
  }

  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  const routesQueue: RouteData[][] = [];

  const findCurrentRouteArr: Array<
    (
      path: string,
      searchParams: Record<string, string>,
      initial: boolean
    ) => boolean
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

  const runHistoryMatching = (
    pathname: string,
    searchParams: Record<string, string>,
    initial: boolean
  ) => {
    for (
      let i = 0;
      i < findCurrentRouteArr.length &&
      findCurrentRouteArr[i](pathname, searchParams, initial);
      i++
    ) {}

    scheduleFlush(historyLane);

    historyEventScheduler.flush();
  };

  const makeExtract =
    (keys: string[], parsers: Record<string, HandleParse>) =>
    (
      target: Record<string, any>,
      stringifiedParams: Record<string, string | undefined>,
      source: any,
      initial: boolean
    ) => {
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];

        target[key] = parsers[key](
          stringifiedParams[key] || undefined,
          source,
          initial
        );
      }
    };

  const wrapRouterRoot = (
    root: RouterControlRoot,
    route: RouteData,
    isHash: boolean
  ) => {
    root._set = root._enqueueSet;

    root._enqueueSet = (value, lane, path) => {
      if (!route._isMatched._value) {
        throw new Error('the route is not matched');
      }

      if (!paramsHandler._hasNavigation) {
        const patch = getRouterPatch(lane);

        patch._paramUpdates.push({
          _root: root,
          _params: value,
          _path: path,
        });

        patch._toAnchor ||= isHash;

        patch._replace &&= replacing._value;
      }
    };
  };

  paramsHandler._commitSet = (patch: RouterPatch | undefined, lane) => {
    if (!patch) {
      return;
    }

    const nav = patch._navigation;

    const updates = patch._paramUpdates;

    const updatesCount = updates.length;

    if (nav) {
      paramsHandler._hasNavigation = false;

      if (!isRouterAvailable && !nav._ignoreBlock && !nav._isHistoryEvent) {
        nav._ignoreBlock = true;

        allowNavigate = () => {
          const nextLane = getSchedulerLane();

          clearUpdateLanes();

          paramsHandler._hasNavigation = true;

          queueRouterPatch(nextLane, patch);

          scheduleFlush(nextLane);
        };

        isLeaveControl._enqueueSet(true, lane);

        return;
      }

      const methods = nav._methods;

      const nextRoutes = methods._routes();

      const nextRoutesCount = nextRoutes.length;

      const nextAnchor = nextRoutes[nextRoutesCount - 1]._anchor;

      const currentRoutes =
        currentRouteIndex < 0
          ? (EMPTY_ARR as RouteData[])
          : routesQueue[currentRouteIndex];

      const isNewPage = currentRoutes != nextRoutes;

      let u = 0;

      let l = nextRoutesCount;

      if (isNewPage) {
        nav._isNewPage = true;

        const prevRoutesCount = currentRoutes.length;

        if (prevRoutesCount > l) {
          l = prevRoutesCount;
        }

        const prevAnchor =
          prevRoutesCount && currentRoutes[prevRoutesCount - 1]._anchor;

        if (prevAnchor) {
          prevAnchor._clear(lane);
        }

        if (nextAnchor) {
          nextAnchor._activate();
        }
      }

      for (let i = 0; i < l; i++) {
        const nextRoute = nextRoutes[i];

        if (isNewPage) {
          const currRoute = currentRoutes[i];

          if (currRoute !== nextRoute) {
            if (nextRoute) {
              nextRoute._isMatched._enqueueSet(true, lane);
            }

            if (currRoute) {
              currRoute._isMatched._enqueueSet(false, lane);

              const params = currRoute._params;

              if (params) {
                (params as RouterControlRoot)._set!(undefined, lane);
              }
            }
          }
        }

        if (nextRoute) {
          const item = updates[u];

          if (item && item._root == nextRoute._params) {
            u++;

            (nextRoute._params as RouterControlRoot)._set!(item._params, lane);
          }
        }
      }

      if (isNewPage) {
        currentRouteIndex = methods._index;
      }

      if (u < updatesCount) {
        const item = updates[u];

        item._root._set!(item._params, lane);
      }

      methods._setComponents();
    } else {
      removeFromArray(paramsHandler._updateLanes, lane);

      for (let i = 0; i < updatesCount; i++) {
        const item = updates[i];

        item._root._set!(item._params, lane, item._path);
      }
    }

    if (!lane._patchByControl.has(updateFinalizer)) {
      addToLevel(lane, updateFinalizer);
    }

    lane._patchByControl.set(updateFinalizer, patch);
  };

  updateFinalizer._commitSet = (patch: RouterPatch, lane) => {
    const nav = patch._navigation;

    const routes = routesQueue[currentRouteIndex];

    let scrollToAnchor = false;

    let path = '';

    let search = '';

    let route;

    let anchorValue = '';

    for (let i = 0; i < routes.length; i++) {
      route = routes[i];

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

    path = (path || '/') + search;

    const anchorParam = route!._anchor;

    if (patch._toAnchor || (nav && nav._isNewPage)) {
      anchorValue = anchorParam ? anchorParam._hash._value : '';

      scrollToAnchor = patch._toAnchor && !!anchorValue;

      path += anchorValue && '#' + anchorValue;
    } else {
      path += location.hash;
    }

    if (path != location.pathname + location.search + location.hash) {
      const state = history.state;

      if (patch._replace) {
        history.replaceState(state, '', path);

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
          saveScroll(state);
        }

        history.pushState(
          {
            ...state,
            idx: ++currentHistoryIndex,
          } satisfies HistoryState,
          '',
          path
        );

        navigationStateRoot._enqueueSet({ action: 'push', delta: 1 }, lane);
      }
    }

    if (scrollToAnchor) {
      anchorParam!._scrollTo(anchorValue);
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

      const storeString: typeof storeAsyncString = _source
        ? storeAsyncString
        : noop;

      const routeData: RouteData = {
        _currentPath: pathParamsCount || !l ? '' : _path[0],
        _currentSearch: '',
        _handlePath: pathParamsCount
          ? (params, typed, peek) => {
              const store: typeof storeAsyncString = peek ? noop : storeString;

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
              const store: typeof storeAsyncString = peek ? noop : storeString;

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
        _extractPathParams: pathParamsCount
          ? makeExtract(_pathParams, _parsers)
          : noop,
        _extractQueryParams: queryParamsCount
          ? makeExtract(_queryParams, _parsers)
          : noop,
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

        wrapRouterRoot(paramsRoot, routeData, false);

        paramsRoot._setExternal = (value) => {
          if (value !== undefined) {
            routeData._handlePath(value, true, false);

            routeData._handleSearch(value, true, false);
          }
        };

        if (paramsRoot._level > maxParamControlLevel) {
          maxParamControlLevel = paramsRoot._level;
        }
      }

      if (_anchor) {
        (_anchor._hash as RouterControlRoot)._route = routeData;

        wrapRouterRoot(_anchor._hash as RouterControlRoot, routeData, true);
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

        const queueMatch = (updates: RouterUpdateEntry[], initial: boolean) => {
          clearUpdateLanes();

          if (_anchor) {
            updates.push({
              _root: _anchor._hash,
              _params: location.hash.slice(1),
              _path: undefined,
            });
          }

          queueRouterPatch(historyLane, {
            _navigation: {
              _methods: methods,
              _isNewPage: false,
              _isHistoryEvent: true,
              _ignoreBlock: false,
              _enableScrollToTop: false,
              _enableScrollRestoration: false,
            },
            _paramUpdates: updates,
            _replace: true,
            _toAnchor: initial,
          });
        };

        findCurrentRouteArr.push(
          _paramsCount
            ? (path, searchParams, initial) => {
                const isMatched = testRegex(path);

                if (isMatched) {
                  const pathParams: Record<string, string> = withPathParams
                    ? (isMatched as RegExpExecArray).groups!
                    : EMPTY_OBJECT;

                  const updates: RouterUpdateEntry[] = [];

                  for (let i = 0; i < routesData.length; i++) {
                    const route = routesData[i];

                    const paramsControl = route._params;

                    if (paramsControl) {
                      route._handlePath(pathParams, false, false);

                      route._handleSearch(searchParams, false, false);

                      if ('_equable' in paramsControl) {
                        paramsControl._equable = false;

                        route._initial = initial;

                        addToQueue(historyLane, paramsControl);
                      } else {
                        const params = {};

                        try {
                          route._extractPathParams(
                            params,
                            pathParams,
                            undefined,
                            initial
                          );

                          route._extractQueryParams(
                            params,
                            searchParams,
                            undefined,
                            initial
                          );
                        } catch {
                          return true;
                        }

                        updates.push({
                          _root: paramsControl,
                          _params: params,
                          _path: undefined,
                        });
                      }
                    }
                  }

                  queueMatch(updates, initial);
                }

                return !isMatched;
              }
            : (path, _, initial) =>
                testRegex(path) ? (queueMatch([], initial), false) : true
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

  const savedScroll = state && state.scroll;

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

      saveScroll(state);

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
              saveScroll(state);
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
            init: 1,
          } satisfies HistoryState,
          ''
        );

        delta = 0;
      }

      isRouterBlockPopupAllowed = true;

      navigationStateRoot._enqueueSet({ action: 'pop', delta }, historyLane);

      runHistoryMatching(
        location.pathname,
        parseSearch(location.search),
        false
      );
    }
  };

  handleRoutes(routes, navigations, paths, EMPTY_ARR, '', 0, false);

  updateFinalizer._level = ++maxParamControlLevel;

  if (pathname.length > 1 && pathname.at(-1) == '/') {
    pathname = pathname.slice(0, -1);

    history.replaceState(state, '', pathname + search + location.hash);
  }

  const applyInitial = !state || !state.init;

  if (state && state.idx != null) {
    currentHistoryIndex = state.idx;
  }

  if (applyInitial || state!.idx == null) {
    history.replaceState(
      {
        ...(typeof state == 'object' ? state : null),
        idx: currentHistoryIndex,
        init: 1,
      } satisfies HistoryState,
      ''
    );
  }

  runHistoryMatching(pathname, searchParams, applyInitial);

  if (savedScroll) {
    const x = savedScroll[0];

    const y = savedScroll[1];

    let appliedX: number;

    let appliedY: number;

    const restore = () => {
      window.scroll(x, y);

      appliedX = window.scrollX;

      appliedY = window.scrollY;

      return appliedX == x && appliedY == y;
    };

    if (!restore() && typeof ResizeObserver != 'undefined') {
      const observer = new ResizeObserver(() => {
        if (
          window.scrollX != appliedX ||
          window.scrollY != appliedY ||
          restore()
        ) {
          observer.disconnect();
        }
      });

      observer.observe(document.documentElement);
    }
  }

  const pageHideListener = () => {
    saveScroll(history.state);
  };

  window.addEventListener('popstate', popStateListener);

  window.addEventListener('pagehide', pageHideListener);

  if (process.env.NODE_ENV !== 'production') {
    devPopStateListener = popStateListener;

    devPageHideListener = pageHideListener;
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
