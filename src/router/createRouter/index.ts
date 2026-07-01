import type { MouseEvent as ReactMouseEvent } from 'react';
import type {
  UnionToIntersection,
  ParamsUpdatedData,
  ProcessParams,
  Hash,
  Navigation,
  RouteData,
  RouteMethods,
  RouterParamUpdates,
  Router,
  NavigationState,
  Route,
  AnyPaths,
  RouterContext,
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

import returnFalse from '#internal/alwaysFalse';
import NOT_FOUND from '#router/NOT_FOUND';
import prepend from '#router/internal/prepend';
import { INTERNALS, EMPTY_ARR, RELOAD } from '#internal/constants';
import { getCurrentLane, getLane, scheduleFlush } from '#internal/flushQueue';
import addToQueue from '#internal/addToQueue';
import scheduleMicrotask from '#internal/scheduleMicrotask';
import type {
  AsyncControl,
  AsyncControlScope,
  Control,
  ControlScope,
  Scheduler,
} from '#types';
import type {
  AsyncControlInternals,
  ControlInternals,
  Lane,
  Mutable,
  PendingItem,
  PrimitiveControlInternals,
} from '#internal/types';
import type { NavigationTarget } from '#router/types';
import createManualScheduler from '#scheduler/createManualScheduler';

type HistoryState = {
  idx?: number;
  scroll?: [x: number, y: number];
  /** User data attached to the history entry; preserved across the router's own rewrites. */
  data?: unknown;
};

/**
 * Commits a value on the given lane, or on the shared microtask lane
 * (joining the current flush if one is running).
 */
const enqueue = (
  internals: Pick<PrimitiveControlInternals, '_enqueueSet'>,
  value: any,
  lane?: Lane
) => {
  if (lane) {
    internals._enqueueSet(value, lane);
  } else {
    const currentLane = getCurrentLane();

    if (currentLane) {
      internals._enqueueSet(value, currentLane);
    } else {
      const microtaskLane = getLane(scheduleMicrotask);

      internals._enqueueSet(value, microtaskLane);

      scheduleFlush(microtaskLane, scheduleMicrotask);
    }
  }
};

const handleParamUpdates = (queue: ParamsUpdatedData[], lane?: Lane) => {
  for (let i = 0; i < queue.length; i++) {
    const { _route, _params } = queue[i];

    const control = _route._params!;

    enqueue(control, _params, lane);
  }
};

const handleHref = (
  routes: RouteData[],
  updatedParams?: RouterParamUpdates[],
  maxControls?: number,
  isMutableOrUseParams?: true | ((route: RouteData) => void),
  useNoop?: () => void,
  lane?: Lane
) => {
  let path = '';

  let search = '';

  let routeIndex = 0;

  const handleRoute = (route: RouteData) => {
    if (route._params) {
      if (!route._isMatched._value) {
        throw new Error('route not mounted');
      }

      if (maxControls) {
        (isMutableOrUseParams as (route: RouteData) => void)(route);

        maxControls--;
      }
    }

    path += route._currentPath;

    if (route._currentSearch) {
      if (search) {
        search += '&' + route._currentSearch;
      } else {
        search = '?' + route._currentSearch;
      }
    }
  };

  if (updatedParams) {
    const updateQueue =
      isMutableOrUseParams === true && ([] as ParamsUpdatedData[]);

    const updatedParamsLastRoute =
      updatedParams[updatedParams.length - 1]._route;

    const updatedParamsLastRouteIndex = updatedParamsLastRoute._selfIndex;

    if (
      updatedParamsLastRouteIndex != routes.length - 1 &&
      updatedParamsLastRoute != routes[updatedParamsLastRouteIndex]
    ) {
      throw new Error('route not mounted');
    }

    for (let i = 0; i < updatedParams.length; i++) {
      const {
        _route: route,
        _params,
        _stringifiedParams = EMPTY_OBJECT,
      } = updatedParams[i];

      const max = route._selfIndex;

      for (; routeIndex < max; routeIndex++) {
        handleRoute(routes[routeIndex]);
      }

      const params =
        typeof _params == 'object'
          ? _params || EMPTY_OBJECT
          : _params!(route._params!._value);

      const nextSearch = route._getSearch(params, _stringifiedParams);

      const nextPath = route._getPath(params, _stringifiedParams);

      if (updateQueue) {
        const source = route._source && route._source._get();

        const target = {};

        route._extractPathParams(target, params, _stringifiedParams, source);

        route._extractQueryParams(target, params, _stringifiedParams, source);

        updateQueue.push({
          _route: route,
          _params: target,
        });
      } else if (maxControls) {
        if (typeof _params == 'function') {
          (isMutableOrUseParams as (route: RouteData) => void)(route);
        } else {
          useNoop!();
        }

        maxControls--;
      }

      path += nextPath;

      if (nextSearch) {
        if (search) {
          search += '&' + nextSearch;
        } else {
          search = '?' + nextSearch;
        }
      }

      routeIndex++;
    }

    if (updateQueue) {
      handleParamUpdates(updateQueue, lane);
    }
  }

  for (; routeIndex < routes.length; routeIndex++) {
    handleRoute(routes[routeIndex]);
  }

  if (maxControls) {
    while (maxControls--) {
      useNoop!();
    }
  }

  return (path || '/') + search;
};

let popStateListener: undefined | ((e: PopStateEvent) => void);

const beforeUnloadListener = (e: BeforeUnloadEvent) => {
  e.preventDefault();

  e.returnValue = true;
};

const createRouter = <Paths extends AnyPaths>(
  paths: Paths
): Router<UnionToIntersection<Paths>> => {
  if (popStateListener) {
    window.removeEventListener('popstate', popStateListener);
  }

  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  const routesQueue: RouteData[][] = [];

  const routerContext: RouterContext = {
    _hash: undefined,
    _path: EMPTY_OBJECT,
    _query: EMPTY_OBJECT,
    _routesQueue: routesQueue,
    _currentIndex: -1,
  };

  const historyEventScheduler = createManualScheduler();

  const paramsHandler: PendingItem = {
    _level: 0,
    _commitSet(_, lane) {
      const isNavigate = lane._routerNavigation;

      const routerParamUpdates = lane._routerParamUpdates;

      for (let i = 0, l = routerParamUpdates.length; i < l; i++) {
        const item = routerParamUpdates[i];

        item._root._enqueueSet(item._value, lane, item._path);
      }

      addToQueue(lane, updateFinalizer);
    },
  };

  const updateFinalizer: PendingItem = {
    _level: 0,
    _commitSet(_, lane) {
      const routes = routesQueue[routerContext._currentIndex];

      let path = '';

      let search = '';

      for (let i = 0; i < routes.length; i++) {
        const route = routes[i];

        const currentSearch = route._currentSearch;

        path += route._currentPath;

        if (currentSearch) {
          if (search) {
            search += '&' + currentSearch;
          } else {
            search = '?' + currentSearch;
          }
        }
      }

      // if (hash) {
      //   href += '#' + hash;
      // }

      if (path == location.pathname && search == location.search) {
        return;
      }

      const state = history.state;

      if (replace) {
        history.replaceState(state, '', href);

        enqueue(navigationStateRoot, { action: 'replace', delta: 0 }, lane);
      } else {
        if (
          enableScrollRestoration == null ? isNewPage : enableScrollRestoration
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

        enqueue(navigationStateRoot, { action: 'push', delta: 1 }, lane);
      }

      if (hash) {
        const anchorParam = routes[routes.length - 1]._anchor;

        if (anchorParam) {
          anchorParam._scrollTo(hash);
        }
      } else if (enableScrollToTop == null ? isNewPage : enableScrollToTop) {
        window.scroll(0, 0);
      }
    },
  };

  let maxParamControlLevel = 0;

  const handleRoutes = (
    routes: Route<any, any, any>,
    navigations: Record<string, Navigation<AnyPaths, any>>,
    paths: AnyPaths,
    findCurrentRouteArr: Array<(path: string, search: string) => boolean>,
    dataQueue: RouteData[][],
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
      function extractParams(
        this: string[],
        target: Record<string, any>,
        stringifiedParams: Record<string, string>,
        source: any
      ) {
        let updated = false;

        for (let i = 0; i < this.length; i++) {
          const key = this[i];

          if (
            _getParse(key)(
              target,
              key,
              stringifiedParams[key] || undefined,
              source
            )
          ) {
            updated = true;
          }
        }

        return updated;
      }

      const key = keys[i] as string;

      const {
        _children,
        _getParse,
        _getStringify,
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

      const path0 = _path[0];

      const isMatchedRoot = makePrimitiveInternals(false);

      const regexStr =
        parentRegexStr + (pathParamsCount ? `(${_regexStr})` : _regexStr);

      const routeData: RouteData = {
        _pathParamsCount: pathParamsCount,
        _currentPath: pathParamsCount || !l ? '' : path0,
        _currentSearch: '',
        _selfIndex: data.length,
        _handlePath: pathParamsCount
          ? (params, typed, peek) => {
              let str = '';

              for (let i = 0; i < l; i++) {
                const item = _path[i];

                if (item[0] == '/') {
                  str += item;
                } else {
                  const param = params[item];

                  const value = typed
                    ? _getStringify(item)(
                        param !== '' ? param : undefined,
                        item
                      )
                    : param || undefined;

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
              let search = '';

              for (let i = 0; i < queryParamsCount; i++) {
                const name = _queryParams[i];

                const param = params[name];

                const value = typed
                  ? _getStringify(name)(param !== '' ? param : undefined, name)
                  : param || undefined;

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
          ? extractParams.bind(_pathParams)
          : returnFalse,
        _extractQueryParams: queryParamsCount
          ? extractParams.bind(_queryParams)
          : returnFalse,
        _isMatched: isMatchedRoot,
        _anchor: _anchor,
        _params: null,
        _source: _source && _source[INTERNALS],
      };

      const _withPathParams = withPathParams || !!pathParamsCount;

      const routesData = append(data, routeData);

      let paramsRoot: AsyncControlInternals | ControlInternals | null = null;

      let paramsControl: ControlScope | AsyncControlScope | undefined;

      if (pathParamsCount || queryParamsCount) {
        paramsControl = _createControlScope(
          routerContext,
          isMatchedRoot,
          _source!,
          routeData
        );

        (routeData as Mutable<RouteData>)._params = paramsRoot = paramsControl[
          INTERNALS
        ] as ControlInternals | AsyncControlInternals;

        if (paramsRoot._level > maxParamControlLevel) {
          maxParamControlLevel = paramsRoot._level;
        }
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
        _update(
          params: ProcessParams<Record<string, any>>,
          hash?: Hash,
          replace?: boolean,
          scheduler?: Scheduler
        ) {
          if (!paramsRoot || !isMatchedRoot._value) {
            if (process.env.NODE_ENV !== 'production') {
              console.warn(
                '[router] updateParams on an unmatched or paramless route was ignored.'
              );
            }

            return;
          }

          const usedScheduler = scheduler || scheduleMicrotask;

          const lane = getLane(usedScheduler);

          const currentRoutes = routesQueue[currentRouteIndex];

          const href = handleHref(
            currentRoutes,
            [{ _params: params, _route: routeData }],
            0,
            true,
            undefined,
            lane
          );

          queueHistorySync(
            lane,
            currentRoutes,
            currentRouteIndex,
            href,
            replace,
            false,
            false,
            false,
            // hash omitted -> keep the current one (updateParams updates only
            // what was passed)
            arguments.length > 1
              ? resolveHash(currentRoutes, hash, lane)
              : currentHash(currentRoutes)
          );

          scheduleFlush(lane, usedScheduler);
        },
      } as unknown as Route<any, any, any>;

      if (
        (pathParamsCount || queryParamsCount) &&
        ++_paramsCount > maxParamsPerRoute
      ) {
        maxParamsPerRoute = _paramsCount;
      }

      if (_children) {
        const childrenNavigation = {};

        handleRoutes(
          route,
          childrenNavigation,
          _children,
          findCurrentRouteArr,
          dataQueue,
          routesData,
          regexStr,
          _paramsCount,
          _withPathParams
        );

        if (paramsControl) {
          const methods: RouteMethods = {
            _navigate(
              event,
              params,
              replace,
              ignoreBlock,
              enableScrollToTop,
              enableScrollRestoration,
              onClick,
              hash
            ) {
              navigate(
                currentRouteIndex,
                dataQueue[currentRouteIndex],
                noop,
                event,
                params,
                replace,
                ignoreBlock,
                enableScrollToTop,
                enableScrollRestoration,
                onClick,
                hash
              );
            },
            _useHref: (params, useParams, useNoop) =>
              handleHref(
                dataQueue[currentRouteIndex],
                params,
                maxParamsPerRoute,
                useParams,
                useNoop
              ),
            _isMatched: isMatchedRoot,
          };

          navigation = function (params) {
            return (
              params !== undefined
                ? {
                    ...childrenNavigation,
                    [ROUTE_METHODS]: methods,
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

        const testRegex = regex[_withPathParams ? 'exec' : 'test'].bind(regex);

        const routeIndex = dataQueue.length;

        const methods: RouteMethods = {
          _navigate(
            event,
            params,
            replace,
            ignoreBlock,
            enableScrollToTop,
            enableScrollRestoration,
            onClick,
            hash
          ) {
            navigate(
              routeIndex,
              routesData,
              setComponents,
              event,
              params,
              replace,
              ignoreBlock,
              enableScrollToTop,
              enableScrollRestoration,
              onClick,
              hash
            );
          },
          _useHref: (params, useParams, useNoop) =>
            handleHref(
              routesData,
              params,
              maxParamsPerRoute,
              useParams,
              useNoop
            ),
          _isMatched: isMatchedRoot,
        };

        const res = {
          [ROUTE_METHODS]: methods,
        } as NavigationTarget<boolean>;

        let setComponents: () => void = noop;

        route._register = (_setComponents) => {
          if (currentRouteIndex == routeIndex) {
            _setComponents();
          }

          setComponents = _setComponents;
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

        dataQueue.push(routesData);

        findCurrentRouteArr.push(
          _paramsCount
            ? (path, search) => {
                const isMatched = testRegex(path);

                if (isMatched) {
                  let isUrlChanged = false;

                  const searchParams: Record<string, string> = {};

                  const pathParams: Record<string, string> = _withPathParams
                    ? (isMatched as RegExpExecArray).groups!
                    : EMPTY_OBJECT;

                  const currentParamsQueue: ParamsUpdatedData[] = [];

                  if (search) {
                    const arr = search.slice(1).split('&');

                    for (let i = 0; i < arr.length; i++) {
                      const t = arr[i].split('=');

                      const value = t[1];

                      if (value) {
                        searchParams[t[0]] = decodeURIComponent(value);
                      }
                    }
                  }

                  for (
                    let i = 0, pathSegmentIndex = 1;
                    i < routesData.length;
                    i++
                  ) {
                    const route = routesData[i];

                    const paramsControl = route._params;

                    if (paramsControl) {
                      const source = route._source;

                      const currentPath = route._pathParamsCount
                        ? (isMatched as RegExpExecArray)[
                            (pathSegmentIndex += route._pathParamsCount)
                          ]
                        : route._currentPath;

                      if (!source || source._get() !== undefined) {
                        const value = source && source._get();

                        const params = {};

                        let paramsWasReplaced = false;

                        try {
                          if (
                            route._extractPathParams(params, pathParams, value)
                          ) {
                            paramsWasReplaced = true;
                          }

                          if (
                            route._extractQueryParams(
                              params,
                              searchParams,
                              value
                            )
                          ) {
                            paramsWasReplaced = true;
                          }
                        } catch (err) {
                          if (source) {
                            enqueue(
                              (paramsControl as AsyncControlInternals)
                                ._errorControl[INTERNALS],
                              err
                            );

                            continue;
                          }

                          return true;
                        }

                        if (paramsWasReplaced) {
                          isUrlChanged = true;

                          currentParamsQueue.push({
                            _params: params,
                            _route: route,
                          });
                        } else {
                          currentParamsQueue.push({
                            _params: params,
                            _route: route,
                          });
                        }
                      } else {
                        currentParamsQueue.push({
                          _params: undefined!,
                          _route: route,
                        });
                      }
                    }
                  }

                  handleParamUpdates(currentParamsQueue);

                  const urlHash = location.hash.slice(1) || undefined;

                  for (let i = 0; i < routesData.length; i++) {
                    routesData[i]._anchor?._commit(
                      urlHash,
                      enqueue,
                      currentRouteIndex < 0
                    );
                  }

                  handleMatching(routesData, setComponents);

                  if (isUrlChanged) {
                    history.replaceState(
                      history.state,
                      '',
                      handleHref(routesData)
                    );
                  }
                }

                return !isMatched;
              }
            : (path) => {
                const isMatched = testRegex(path) as boolean;

                if (isMatched) {
                  handleMatching(routesData, setComponents);
                }

                return !isMatched;
              }
        );
      }

      (routes as any)[key] = route;

      navigations[key] = navigation as Navigation<any, any, any, any>;
    }
  };

  const handleMatching = (
    nextRoutes: RouteData[],
    setComponents: () => void,
    lane?: Lane
  ) => {
    if (currentRouteIndex >= 0) {
      const currentRoutes = routesQueue[currentRouteIndex];

      if (currentRoutes != nextRoutes) {
        const maxLength = Math.max(nextRoutes.length, currentRoutes.length);

        for (let i = 0; i < maxLength; i++) {
          const currRoute = currentRoutes[i];

          const nextRoute = nextRoutes[i];

          if (currRoute != nextRoute) {
            if (nextRoute) {
              enqueue(nextRoute._isMatched, true, lane);

              nextRoute._anchor?._activate(enqueue);
            }

            if (currRoute) {
              enqueue(currRoute._isMatched, false, lane);

              currRoute._anchor?._clear(enqueue, lane);

              const params = currRoute._params;

              if (params) {
                // a real commit (not a silent clear) so dependents — bound
                // registry items, derived controls — unbind and release loads
                if ('_errorControl' in params) {
                  enqueue(params._errorControl[INTERNALS], RELOAD, lane);
                } else {
                  enqueue(params, undefined, lane);
                }
              }
            }
          }
        }
      }
    } else {
      // initial matching runs before any listener can exist — write directly
      // so first-render href reads see the matched state
      for (let i = 0; i < nextRoutes.length; i++) {
        nextRoutes[i]._isMatched._value = true;

        nextRoutes[i]._anchor?._activate(enqueue);
      }
    }

    setComponents();
  };

  /** Current committed hash of the chain's anchor route, if any. */
  const currentHash = (routes: RouteData[]): string | undefined => {
    for (let i = routes.length; i--; ) {
      const anchorParam = routes[i]._anchor;

      if (anchorParam) {
        return anchorParam._get();
      }
    }
  };

  /**
   * Resolves the hash argument against the chain's current hash and commits
   * it to every anchor route in the chain.
   */
  const resolveHash = (
    routes: RouteData[],
    hash: Hash,
    lane: Lane
  ): string | undefined => {
    const resolvedHash =
      typeof hash == 'function' ? hash(currentHash(routes)) : hash;

    for (let i = 0; i < routes.length; i++) {
      routes[i]._anchor?._set(resolvedHash, enqueue, lane);
    }

    return resolvedHash;
  };

  /**
   * Queues a one-shot node into the lane, one level above the path's controls,
   * so it runs after their commits: verifies the navigation wasn't superseded,
   * skips when the URL wouldn't change, otherwise writes history and commits
   * the navigation state.
   */
  const queueHistorySync = (
    lane: Lane,
    routes: RouteData[],
    index: number,
    href: string,
    replace: boolean | undefined,
    isNewPage: boolean,
    enableScrollToTop: boolean | undefined,
    enableScrollRestoration: boolean | undefined,
    hash: string | undefined
  ) => {
    addToQueue(lane, {
      _level: maxParamControlLevel,
      _commitSet() {
        if (currentRouteIndex != index) {
          // superseded by a newer navigation in the same flush
          return;
        }

        if (hash) {
          href += '#' + hash;
        }

        if (href == location.pathname + location.search + location.hash) {
          return;
        }

        const state = history.state;

        if (replace) {
          history.replaceState(state, '', href);

          enqueue(navigationStateRoot, { action: 'replace', delta: 0 }, lane);
        } else {
          if (
            enableScrollRestoration == null
              ? isNewPage
              : enableScrollRestoration
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

          enqueue(navigationStateRoot, { action: 'push', delta: 1 }, lane);
        }

        if (hash) {
          const anchorParam = routes[routes.length - 1]._anchor;

          if (anchorParam) {
            anchorParam._scrollTo(hash);
          }
        } else if (enableScrollToTop == null ? isNewPage : enableScrollToTop) {
          window.scroll(0, 0);
        }
      },
    } as unknown as ControlInternals);
  };

  const navigate = (
    index: number,
    routes: RouteData[],
    setComponents: () => void,
    event: ReactMouseEvent<HTMLAnchorElement, any> | null,
    params: RouterParamUpdates[] | undefined,
    replace: boolean | undefined,
    ignoreBlock: boolean | undefined,
    enableScrollToTop: boolean | undefined,
    enableScrollRestoration: boolean | undefined,
    onClick:
      | ((event: ReactMouseEvent<HTMLAnchorElement, any>) => void)
      | undefined,
    hash?: Hash
  ) => {
    if (event) {
      if (onClick) {
        onClick(event);
      }

      const { target } = event.currentTarget;

      if (
        (target && target != '_self') ||
        event.button ||
        event.metaKey ||
        event.altKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.defaultPrevented
      ) {
        return;
      }

      event.preventDefault();
    }

    const fn = () => {
      const isNewPage = currentRouteIndex != index;

      const lane = getCurrentLane() || getLane(scheduleMicrotask);

      const href = handleHref(routes, params, 0, true, undefined, lane);

      // navigate clears the hash unless one was passed
      const resolvedHash = resolveHash(routes, hash, lane);

      handleMatching(routes, setComponents, lane);

      currentRouteIndex = index;

      queueHistorySync(
        lane,
        routes,
        index,
        href,
        replace,
        isNewPage,
        enableScrollToTop,
        enableScrollRestoration,
        resolvedHash
      );

      scheduleFlush(lane, scheduleMicrotask);
    };

    if (isRouterAvailable || ignoreBlock) {
      fn();
    } else {
      allowNavigate = fn;

      enqueue(isLeaveControl, true);
    }
  };

  const findCurrentRouteArr: Array<(path: string, search: string) => boolean> =
    [];

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

  let { pathname, search } = location;

  let delta = 0;

  let isPopTriggeredByBlocking = false;

  let isRouterBlockPopupAllowed = true;

  let isPopTriggeredForScrollSave = false;

  let isPopTriggeredByScrollSaving = false;

  let currentHistoryIndex = 0;

  let isRouterAvailable = true;

  let allowNavigate: () => void = noop;

  let maxParamsPerRoute = 0;

  let currentRouteIndex = -1;

  popStateListener = (e) => {
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
        // foreign history entry (third-party pushState) — stamp it so
        // subsequent pops have a usable index; direction is unknowable,
        // assume forward
        currentHistoryIndex++;

        history.replaceState(
          {
            ...(state as HistoryState),
            idx: currentHistoryIndex,
          } satisfies HistoryState,
          ''
        );

        delta = 0;
      }

      isRouterBlockPopupAllowed = true;

      enqueue(navigationStateRoot, { action: 'pop', delta });

      const { pathname, search } = location;

      for (
        var i = 0;
        i < findCurrentRouteArr.length &&
        findCurrentRouteArr[i](pathname, search);
        i++
      ) {}

      currentRouteIndex = i;
    }
  };

  handleRoutes(
    routes,
    navigations,
    paths,
    findCurrentRouteArr,
    routesQueue,
    EMPTY_ARR,
    '',
    0,
    false
  );

  maxParamControlLevel++;

  if (pathname.length > 1 && pathname.at(-1) == '/') {
    pathname = pathname.slice(0, -1);

    history.replaceState(state, '', pathname + search);
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

  for (
    var routeIndex = 0;
    routeIndex < findCurrentRouteArr.length &&
    findCurrentRouteArr[routeIndex](pathname, search);
    routeIndex++
  ) {}

  currentRouteIndex = routeIndex;

  window.addEventListener('popstate', popStateListener);

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
