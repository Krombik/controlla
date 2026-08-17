import type {
  ValueOrUpdater,
  Hash,
  ParamParser,
  Navigation,
  RouteData,
  RouteMethods,
  RouterControlRoot,
  RouterPatch,
  Router,
  NavigationState,
  Route,
  AnyPaths,
  RouterWrite,
  ChunkBuilder,
} from '#router/internal/types';

import noop from '#internal/noop';

import {
  ROUTE_METHODS,
  ROUTE_PARAMS,
  ROUTE_HASH,
  EMPTY_OBJECT,
} from '#router/internal/constants';
import makePrimitiveInternals from '#internal/makePrimitiveInternals';
import append from '#internal/append';

import NOT_FOUND from '#router/NOT_FOUND';
import { INTERNALS, EMPTY_ARR, PASSIVE } from '#internal/constants';
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
  clearWrites,
  getRouterPatch,
  paramsHandler,
  replacing,
  urlFinalizer,
} from '#router/internal/state';
import queueRouterPatch from '#router/internal/queueRouterPatch';
import removeFromArray from '#internal/removeFromArray';
import scheduleSet from '#internal/scheduleSet';
import throwNotMatched from '#router/internal/throwNotMatched';
import watchReflow from '#router/internal/watchReflow';
import reportError from '#internal/reportError';
import safeSessionStorage from '#persist/safeSessionStorage';

type HistoryState = {
  idx?: number;
};

let devPopStateListener: undefined | ((e: PopStateEvent) => void);

let devScrollListener: undefined | (() => void);

let stopRestore = noop;

function buildStaticPath(
  this: RouteData,
  _params: any,
  _typed: boolean,
  peek: boolean
): any {
  if (peek) {
    return this._currentPath;
  }
}

function buildEmpty(_params: any, _typed: boolean, peek: boolean): any {
  if (peek) {
    return '';
  }
}

/**
 * Creates the app's router (there is exactly one) from the given path tree:
 * matches the current URL right away, keeps every route's params control in
 * sync with the address bar and takes over history, scroll restoration and
 * anchor scrolling.
 *
 * Returns the typed `routes` tree (every route is a readonly `isMatched`
 * control), the `navigation` tree for building `navigate`/`Link` targets,
 * a `navigationState` control (`push` / `replace` / `pop`) and the
 * `navigationBlocker`.
 *
 * @example
 * ```ts
 * const router = createRouter(
 *   withNotFound({
 *     home: createPath(),
 *     product: createPath('product', param({ id: false })),
 *   })
 * );
 *
 * navigate(router.navigation.product({ id: '42' }));
 * ```
 */
const createRouter = <Paths extends AnyPaths>(paths: Paths): Router<Paths> => {
  const SCROLL_POS_HISTORY_KEY = 'controlla.SPH';
  const CURRENT_SCROLL_POS_KEY = 'controlla.CSP';

  const SCROLL_SAVE_DELAY = 100;

  if (process.env.NODE_ENV !== 'production') {
    if (devPopStateListener) {
      window.removeEventListener('popstate', devPopStateListener);

      window.removeEventListener('scroll', devScrollListener!);

      stopRestore();
    }

    clearWrites();
  }

  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  const beforeUnloadListener = (e: BeforeUnloadEvent) => {
    e.preventDefault();

    e.returnValue = true;
  };

  const saveScrollPosHistory: () => void = safeSessionStorage
    ? () => {
        safeSessionStorage!.setItem(
          SCROLL_POS_HISTORY_KEY,
          scrollPosHistory.join()
        );
      }
    : noop;

  const restoreScroll = (x: number, y: number) => {
    const documentElement = document.documentElement;

    const apply = () => {
      if (documentElement.scrollHeight - window.innerHeight >= y) {
        window.scroll({ left: x, top: y, behavior: 'instant' });
      }
    };

    apply();

    stopRestore = watchReflow(apply);
  };

  const chains: RouteData[][] = [];

  const matchers: Array<
    (
      path: string,
      searchParams: Record<string, string>,
      initial: boolean
    ) => boolean
  > = [];

  let currentChainIndex = -1;

  let maxLinkSlots = 0;

  const asyncStrings: Record<string, string | undefined> = {};

  const storeAsyncParam = (key: string, value: string | undefined) => {
    asyncStrings[key] = value;
  };

  const getMaxLinkSlots = () => maxLinkSlots;

  const currentChainMethods: RouteMethods = {
    _routes: () => chains[currentChainIndex],
    _maxSlots: getMaxLinkSlots,
    _index: -1,
    _setComponents: noop,
  };

  let wasBooted = false;

  const historyEventScheduler = createManualScheduler();

  const historyLane = getLane(historyEventScheduler);

  const matchLocation = (
    pathname: string,
    searchParams: Record<string, string>,
    initial: boolean
  ) => {
    for (
      let i = 0;
      i < matchers.length && matchers[i](pathname, searchParams, initial);
      i++
    ) {}

    scheduleFlush(historyLane);

    historyEventScheduler.flush();
  };

  const makeParse =
    (keys: string[], parsers: Record<string, ParamParser>) =>
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

  const wrapRoot = (
    root: RouterControlRoot,
    route: RouteData,
    isHash: boolean
  ) => {
    root._set = root._enqueueSet;

    root._enqueueSet = (value, lane, _fromSource, path) => {
      if (!route._isMatched._value) {
        throwNotMatched();
      }

      if (!paramsHandler._hasNavigation) {
        const patch = getRouterPatch(lane);

        patch._updates.push({
          _root: root,
          _params: value,
          _path: path,
        });

        patch._hashChanged ||= isHash;

        patch._replace &&= replacing._value;
      }
    };
  };

  paramsHandler._commitSet = (patch: RouterPatch | undefined, lane) => {
    if (!patch) {
      return;
    }

    const nav = patch._navigation;

    const updates = patch._updates;

    const updatesCount = updates.length;

    if (nav) {
      paramsHandler._hasNavigation = false;

      if (!canNavigate && !nav._ignoreBlock && !nav._isHistoryEvent) {
        nav._ignoreBlock = true;

        resumeNavigation = () => {
          const nextLane = getSchedulerLane();

          clearWrites();

          paramsHandler._hasNavigation = true;

          queueRouterPatch(nextLane, patch);

          scheduleFlush(nextLane);
        };

        // a history event is never parked here, so this is somebody navigating
        pendingNavigationRoot._enqueueSet(true, lane, false);

        return;
      }

      // the address bar moved on its own - a `pop`, or the url the app opened
      // with - so the params below are not somebody's write
      const fromSource = nav._isHistoryEvent;

      const methods = nav._methods;

      const nextRoutes = methods._routes();

      const nextRoutesCount = nextRoutes.length;

      const currentRoutes =
        currentChainIndex < 0
          ? (EMPTY_ARR as RouteData[])
          : chains[currentChainIndex];

      const isNewPage = currentRoutes != nextRoutes;

      let u = 0;

      let count = nextRoutesCount;

      if (isNewPage) {
        nav._isNewPage = true;

        const prevRoutesCount = currentRoutes.length;

        const nextAnchor = nextRoutes[nextRoutesCount - 1]._anchor;

        if (prevRoutesCount > count) {
          count = prevRoutesCount;
        }

        if (prevRoutesCount) {
          currentRoutes[prevRoutesCount - 1]._anchor?._clear();
        }

        if (nextAnchor) {
          nextAnchor._activate(lane, patch._hashChanged);
        }
      }

      for (let i = 0; i < count; i++) {
        const nextRoute = nextRoutes[i];

        if (isNewPage) {
          const currRoute = currentRoutes[i];

          if (currRoute !== nextRoute) {
            if (nextRoute) {
              nextRoute._isMatched._enqueueSet(true, lane, fromSource);
            }

            if (currRoute) {
              currRoute._isMatched._enqueueSet(false, lane, fromSource);
            }
          }
        }

        if (nextRoute) {
          const item = updates[u];

          if (item && item._root == nextRoute._params) {
            u++;

            (nextRoute._params as RouterControlRoot)._set!(
              item._params,
              lane,
              fromSource
            );
          }
        }
      }

      if (isNewPage) {
        currentChainIndex = methods._index;
      }

      if (u < updatesCount) {
        const item = updates[u];

        item._root._set!(item._params, lane, fromSource);
      }
    } else {
      removeFromArray(paramsHandler._lanes, lane);

      for (let i = 0; i < updatesCount; i++) {
        const item = updates[i];

        item._root._set!(item._params, lane, false, item._path);
      }
    }

    const queuedFinalizer = lane._patchByControl.get(urlFinalizer) as
      RouterPatch | undefined;

    if (queuedFinalizer === undefined) {
      addToLevel(lane, urlFinalizer);

      lane._patchByControl.set(urlFinalizer, patch);
    } else if (!queuedFinalizer._navigation) {
      lane._patchByControl.set(urlFinalizer, patch);
    }
  };

  urlFinalizer._commitSet = (patch: RouterPatch, lane) => {
    const nav = patch._navigation;

    if (nav) {
      // the page swaps here rather than with the params, so it renders on the
      // values every route already committed
      nav._methods._setComponents();

      // the address bar is where a `pop` came from, and the entry it landed on
      // was written from here - nothing to sync, and it never scrolls either.
      // The url the app booted on is the one that hasn't been through this yet
      if (nav._isHistoryEvent && wasBooted) {
        return;
      }
    }

    const routes = chains[currentChainIndex];

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
        search = search ? search + '&' + currentSearch : '?' + currentSearch;
      }
    }

    path = (path || '/') + search;

    const anchorParam = route!._anchor;

    if (patch._hashChanged || (nav && nav._isNewPage)) {
      if (anchorParam) {
        // unmatched reads as `undefined`, like a route's params do
        anchorValue = anchorParam._hash._value || '';
      }

      if (anchorValue) {
        scrollToAnchor = patch._hashChanged && (!nav || !nav._isHistoryEvent);

        path += '#' + anchorValue;
      }
    } else {
      path += location.hash;
    }

    if (path != location.pathname + location.search + location.hash) {
      const state = history.state;

      try {
        if (patch._replace) {
          history.replaceState(state, '', path);

          if (!nav || !nav._isHistoryEvent) {
            navigationStateRoot._enqueueSet(
              { action: 'replace', delta: 0 },
              lane,
              false
            );
          }
        } else {
          const nextHistoryIndex = currentHistoryIndex + 1;

          history.pushState(
            {
              ...state,
              idx: nextHistoryIndex,
            } satisfies HistoryState,
            '',
            path
          );

          const nextPosHistorySize = nextHistoryIndex * 2;

          scrollPosHistory.length = nextPosHistorySize;

          if (
            nav &&
            (nav._scrollRestoration == null
              ? nav._isNewPage
              : nav._scrollRestoration)
          ) {
            scrollPosHistory[nextPosHistorySize - 2] = Math.round(
              window.scrollX
            );
            scrollPosHistory[nextPosHistorySize - 1] = Math.round(
              window.scrollY
            );
          } else {
            // whatever an earlier departure left here is stale now
            scrollPosHistory[nextPosHistorySize - 2] = undefined;

            scrollPosHistory[nextPosHistorySize - 1] = undefined;
          }

          saveScrollPosHistory();

          knownLength = history.length;

          // only once the entry exists, or the index outruns the real history
          currentHistoryIndex = nextHistoryIndex;

          navigationStateRoot._enqueueSet(
            { action: 'push', delta: 1 },
            lane,
            false
          );
        }
      } catch (err) {
        // the browser refused the write - safari throttles history to 100 calls
        // per 30s - so the url stays behind while the params are committed
        reportError(err);
      }
    }

    if (scrollToAnchor) {
      anchorParam!._scrollTo(anchorValue);
    } else if (
      nav &&
      (nav._scrollToTop == null ? nav._isNewPage : nav._scrollToTop)
    ) {
      window.scroll(0, 0);
    }
  };

  let maxParamControlLevel = 0;

  const buildRoutes = (
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
        _defaults,
      } = paths[key];

      const pathParamsCount = _pathParams.length;

      const queryParamsCount = _queryParams.length;

      const segmentsCount = _path.length;

      const isMatchedRoot = makePrimitiveInternals(false);

      const regexStr =
        parentRegexStr + (pathParamsCount ? `(${_regexStr})` : _regexStr);

      const storeString: typeof storeAsyncParam = _source
        ? storeAsyncParam
        : noop;

      const routeData: RouteData = {
        _currentPath: pathParamsCount || !segmentsCount ? '' : _path[0],
        _currentSearch: '',
        _buildPath: pathParamsCount
          ? (((params, typed, peek) => {
              const store: typeof storeAsyncParam = peek ? noop : storeString;

              let str = '';

              for (let i = 0; i < segmentsCount; i++) {
                const item = _path[i];

                if (item[0] == '/') {
                  str += item;
                } else {
                  const param = params[item];

                  let value: string | undefined;

                  // an absent param skips its stringifier, and a stringifier
                  // dropping the param by returning `''` reads as absent too
                  if (param !== undefined && param !== '') {
                    value = typed
                      ? _stringifies[item](param)
                      : (param as string);

                    if (value !== '') {
                      str += '/' + value;
                    }
                  }

                  store(item, value);
                }
              }

              if (peek) {
                return str;
              }

              (routeData as Mutable<RouteData>)._currentPath = str;
            }) as ChunkBuilder)
          : segmentsCount
            ? buildStaticPath
            : buildEmpty,
        _buildSearch: queryParamsCount
          ? (((params, typed, peek) => {
              const store: typeof storeAsyncParam = peek ? noop : storeString;

              let search = '';

              for (let i = 0; i < queryParamsCount; i++) {
                const name = _queryParams[i];

                const param = params[name];

                let value: string | undefined;

                if (param !== undefined && param !== '') {
                  value = typed ? _stringifies[name](param) : (param as string);

                  if (value !== '') {
                    search = search
                      ? `${search}&${name}=${encodeURIComponent(value)}`
                      : `${name}=${encodeURIComponent(value)}`;
                  }
                }

                store(name, value);
              }

              if (peek) {
                return search;
              }

              (routeData as Mutable<RouteData>)._currentSearch = search;
            }) as ChunkBuilder)
          : buildEmpty,
        _parsePath: pathParamsCount ? makeParse(_pathParams, _parsers) : noop,
        _parseQuery: queryParamsCount
          ? makeParse(_queryParams, _parsers)
          : noop,
        _isMatched: isMatchedRoot,
        _anchor: _anchor,
        _params: null,
        _defaults,
        _source: _source && _source[INTERNALS],
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

        wrapRoot(paramsRoot, routeData, false);

        paramsRoot._setExternal = (value) => {
          if (value !== undefined) {
            try {
              routeData._buildPath(value, true, false);

              routeData._buildSearch(value, true, false);
            } catch (err) {
              reportError(err);
            }
          }
        };

        if (paramsRoot._level > maxParamControlLevel) {
          maxParamControlLevel = paramsRoot._level;
        }
      }

      if (_anchor) {
        wrapRoot(_anchor._hash as RouterControlRoot, routeData, true);
      }

      let _paramsCount = paramsCount;

      let navigation: (
        this: NavigationTarget<boolean>,
        params?: ValueOrUpdater<Record<string, any>> | Hash,
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

        buildRoutes(
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
            const parentParams = this[ROUTE_PARAMS];

            return (
              params !== undefined
                ? {
                    ...childrenNavigation,
                    [ROUTE_METHODS]: currentChainMethods,
                    [ROUTE_PARAMS]: parentParams
                      ? append(parentParams, {
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
                : parentParams
                  ? {
                      ...childrenNavigation,
                      [ROUTE_METHODS]: currentChainMethods,
                      [ROUTE_PARAMS]: parentParams,
                    }
                  : childrenNavigation
            ) as NavigationTarget<boolean>;
          };
        } else {
          navigation = function () {
            const parentParams = this[ROUTE_PARAMS];

            return (
              parentParams
                ? {
                    ...childrenNavigation,
                    [ROUTE_METHODS]: currentChainMethods,
                    [ROUTE_PARAMS]: parentParams,
                  }
                : childrenNavigation
            ) as NavigationTarget<boolean>;
          };
        }
      } else {
        const regex = new RegExp(`^${regexStr || '/'}$`);

        const testRegex = regex[withPathParams ? 'exec' : 'test'].bind(regex);

        const routeIndex = chains.length;

        const methods: RouteMethods = {
          _routes: () => routesData,
          _maxSlots: getMaxLinkSlots,
          _index: routeIndex,
          _setComponents: noop,
        };

        const emptyTarget = {
          [ROUTE_METHODS]: methods,
          [ROUTE_HASH]: undefined,
          [ROUTE_PARAMS]: undefined,
        } as NavigationTarget<boolean>;

        route._register = (setComponents) => {
          if (currentChainIndex == routeIndex) {
            setComponents();
          }

          methods._setComponents = setComponents;
        };

        (route as Mutable<typeof route>)._anchor = _anchor;

        (route as Mutable<typeof route>)._routes = routesData;

        navigation = paramsControl
          ? function (params, hash) {
              const parentParams = this[ROUTE_PARAMS];

              return (
                params !== undefined
                  ? {
                      [ROUTE_METHODS]: methods,
                      [ROUTE_HASH]: hash,
                      [ROUTE_PARAMS]: parentParams
                        ? append(parentParams, {
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
                  : parentParams
                    ? {
                        [ROUTE_METHODS]: methods,
                        [ROUTE_HASH]: undefined,
                        [ROUTE_PARAMS]: parentParams,
                      }
                    : emptyTarget
              ) as NavigationTarget<boolean>;
            }
          : function (hash) {
              const parentParams = this[ROUTE_PARAMS];

              return (
                parentParams || hash !== undefined
                  ? {
                      [ROUTE_METHODS]: methods,
                      [ROUTE_HASH]: hash as Hash,
                      [ROUTE_PARAMS]: parentParams,
                    }
                  : emptyTarget
              ) as NavigationTarget<boolean>;
            };

        if (routesData.length > maxLinkSlots) {
          maxLinkSlots = routesData.length;
        }

        chains.push(routesData);

        const queueMatch = (updates: RouterWrite[], initial: boolean) => {
          clearWrites();

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
              _scrollToTop: false,
              _scrollRestoration: false,
            },
            _updates: updates,
            _replace: true,
            _hashChanged: initial,
          });
        };

        matchers.push(
          _paramsCount
            ? (path, searchParams, initial) => {
                const isMatched = testRegex(path);

                if (isMatched) {
                  const pathParams: Record<string, string> = withPathParams
                    ? (isMatched as RegExpExecArray).groups!
                    : EMPTY_OBJECT;

                  const updates: RouterWrite[] = [];

                  for (let i = 0; i < routesData.length; i++) {
                    const route = routesData[i];

                    const paramsControl = route._params;

                    if (paramsControl) {
                      route._buildPath(pathParams, false, false);

                      route._buildSearch(searchParams, false, false);

                      // async-path params are derived: mark stale, their mapper re-parses
                      if ('_upToDate' in paramsControl) {
                        paramsControl._upToDate = false;

                        route._initial = initial;

                        addToQueue(historyLane, paramsControl);
                      } else {
                        const params = {};

                        try {
                          route._parsePath(
                            params,
                            pathParams,
                            undefined,
                            initial
                          );

                          route._parseQuery(
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

  const pendingNavigationRoot = makePrimitiveInternals(false);

  const navigationStateRoot = makePrimitiveInternals({
    action: 'none',
    delta: 0,
  } satisfies NavigationState);

  const $navigationState = {
    [INTERNALS]: navigationStateRoot,
  } as unknown as Router<any>['navigationState'];

  const state = history.state as HistoryState | null;

  const navigations: Record<string, Navigation<AnyPaths, any>> = {};

  const routes: Route<any, any, any> = {} as any;

  const { search } = location;

  const searchParams = parseSearch(search);

  let { pathname } = location;

  let delta = 0;

  let isBlockedPop = false;

  let canBlockPop = true;

  let knownLength = history.length;

  let historyRepairResolve: ((value: true) => void) | undefined | void;

  let repairedUrl = '';

  let currentHistoryIndex = 0;

  let canNavigate = true;

  let resumeNavigation: () => void = noop;

  const popStateListener = (e: PopStateEvent) => {
    if (historyRepairResolve) {
      history.pushState(
        {
          ...(history.state as HistoryState),
          idx: currentHistoryIndex,
        } satisfies HistoryState,
        '',
        repairedUrl
      );

      knownLength = history.length;

      historyRepairResolve = historyRepairResolve(true);

      return;
    }

    const state = e.state as HistoryState | null;

    const nextHistoryIndex = state && state.idx;

    if (nextHistoryIndex != null) {
      if (isBlockedPop) {
        isBlockedPop = false;

        scheduleSet(pendingNavigationRoot, true, true);
      } else {
        delta = nextHistoryIndex - currentHistoryIndex;

        if (delta) {
          // blocker active: undo the pop and park it for allow()/deny()
          isBlockedPop = canBlockPop && !canNavigate;

          if (isBlockedPop) {
            resumeNavigation = () => {
              canBlockPop = false;

              history.go(delta);
            };

            history.go(-delta);

            return;
          }

          const nextScrollPosHistoryIndex = nextHistoryIndex * 2;

          const currScrollPosHistoryIndex = currentHistoryIndex * 2;

          const nextScrollX = scrollPosHistory[nextScrollPosHistoryIndex];

          if (nextScrollX != null) {
            scrollPosHistory[currScrollPosHistoryIndex] = Math.round(
              window.scrollX
            );

            scrollPosHistory[currScrollPosHistoryIndex + 1] = Math.round(
              window.scrollY
            );

            saveScrollPosHistory();

            restoreScroll(
              nextScrollX,
              scrollPosHistory[nextScrollPosHistoryIndex + 1]!
            );
          } else if (scrollPosHistory[currScrollPosHistoryIndex] != null) {
            scrollPosHistory[currScrollPosHistoryIndex] = undefined;

            scrollPosHistory[currScrollPosHistoryIndex + 1] = undefined;

            saveScrollPosHistory();
          }

          currentHistoryIndex = nextHistoryIndex;

          canBlockPop = true;
        }
      }
    } else {
      delta = 0;
    }

    navigationStateRoot._enqueueSet(
      { action: 'pop', delta },
      historyLane,
      true
    );

    matchLocation(location.pathname, parseSearch(location.search), false);
  };

  buildRoutes(routes, navigations, paths, EMPTY_ARR, '', 0, false);

  // the finalizer commits after every params control, and the state it writes
  // sits with it - it is the routes' change, so whatever derives from it must
  // commit after them rather than a level below
  (navigationStateRoot as Mutable<typeof navigationStateRoot>)._level =
    urlFinalizer._level = maxParamControlLevel + 1;

  if (pathname.length > 1 && pathname.at(-1) == '/') {
    pathname = pathname.slice(0, -1);

    history.replaceState(state, '', pathname + search + location.hash);
  }

  let isKnownEntry = true;

  if (state && state.idx != null) {
    currentHistoryIndex = state.idx;
  } else {
    isKnownEntry = false;

    history.replaceState(
      {
        ...(typeof state == 'object' ? state : null),
        idx: currentHistoryIndex,
      } satisfies HistoryState,
      ''
    );

    if (safeSessionStorage) {
      safeSessionStorage.removeItem(SCROLL_POS_HISTORY_KEY);

      safeSessionStorage.removeItem(CURRENT_SCROLL_POS_KEY);
    }
  }

  let scrollPosHistory: (number | undefined)[];

  const rawScrollPosHistory =
    isKnownEntry &&
    safeSessionStorage &&
    safeSessionStorage.getItem(SCROLL_POS_HISTORY_KEY);

  if (rawScrollPosHistory) {
    scrollPosHistory = [];

    const rawSize = rawScrollPosHistory.length;

    let start = 0;
    let comma;
    let end;

    do {
      comma = rawScrollPosHistory.indexOf(',', start);

      end = rawScrollPosHistory.indexOf(',', comma + 1);

      if (end < 0) {
        end = rawSize;
      }

      if (comma > start) {
        scrollPosHistory.push(
          +rawScrollPosHistory.slice(start, comma),
          +rawScrollPosHistory.slice(comma + 1, end)
        );
      } else {
        scrollPosHistory.push(undefined, undefined);
      }

      start = end + 1;
    } while (start <= rawSize);
  } else {
    scrollPosHistory = Array(currentHistoryIndex * 2);
  }

  const rawSavedScroll =
    isKnownEntry &&
    safeSessionStorage &&
    safeSessionStorage.getItem(CURRENT_SCROLL_POS_KEY);

  let restoreX: number | undefined;

  let restoreY: number | undefined;

  if (rawSavedScroll) {
    let comma = rawSavedScroll.indexOf(',');

    if (+rawSavedScroll.slice(0, comma) == currentHistoryIndex) {
      const start = comma + 1;

      comma = rawSavedScroll.indexOf(',', start);

      restoreX = +rawSavedScroll.slice(start, comma);

      restoreY = +rawSavedScroll.slice(comma + 1);
    }
  }

  if (restoreX === undefined) {
    const currentScrollPosHistoryIndex = currentHistoryIndex * 2;

    restoreX = scrollPosHistory[currentScrollPosHistoryIndex];

    restoreY = scrollPosHistory[currentScrollPosHistoryIndex + 1];
  }

  // nothing to restore means this entry has not been visited, so the params'
  // initial values apply - and the url's hash is a fresh instruction, not
  // something being returned to
  matchLocation(pathname, searchParams, restoreX === undefined);

  wasBooted = true;

  if (currentChainIndex < 0) {
    throw new Error(`no path matched "${pathname}" - use withNotFound`);
  }

  if (restoreX !== undefined) {
    restoreScroll(restoreX, restoreY!);
  }

  let scrollSaveTimeout: ReturnType<typeof setTimeout> | undefined;

  const scrollListener = () => {
    if (scrollSaveTimeout === undefined) {
      scrollSaveTimeout = setTimeout(() => {
        scrollSaveTimeout = undefined;

        safeSessionStorage!.setItem(
          CURRENT_SCROLL_POS_KEY,
          `${currentHistoryIndex},${Math.round(window.scrollX)},${Math.round(window.scrollY)}`
        );
      }, SCROLL_SAVE_DELAY);
    }
  };

  window.addEventListener('popstate', popStateListener);

  if (safeSessionStorage) {
    window.addEventListener('scroll', scrollListener, PASSIVE);
  }

  if (process.env.NODE_ENV !== 'production') {
    devPopStateListener = popStateListener;

    devScrollListener = scrollListener;
  }

  return {
    routes: routes as any,
    navigation: navigations as any,
    navigationState: $navigationState,
    repairHistory: () =>
      new Promise<boolean>((resolve) => {
        const foreignCount = history.length - knownLength;

        if (foreignCount < 1 || !currentHistoryIndex) {
          resolve(false);
        } else {
          repairedUrl = location.pathname + location.search + location.hash;

          historyRepairResolve = resolve;

          history.go(-foreignCount - 1);
        }
      }),
    navigationBlocker: {
      enable() {
        canNavigate = false;

        window.addEventListener('beforeunload', beforeUnloadListener);

        return this.disable;
      },
      disable() {
        canNavigate = true;

        window.removeEventListener('beforeunload', beforeUnloadListener);
      },
      isPendingNavigation: {
        [INTERNALS]: pendingNavigationRoot,
        allow() {
          scheduleSet(pendingNavigationRoot, false, false);

          resumeNavigation();

          resumeNavigation = noop;
        },
        deny() {
          scheduleSet(pendingNavigationRoot, false, false);

          resumeNavigation = noop;
        },
      } as Router<any>['navigationBlocker']['isPendingNavigation'],
    },
  };
};

export default createRouter;
