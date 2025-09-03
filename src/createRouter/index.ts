import type { MouseEvent as ReactMouseEvent } from 'react';
import type {
  AsyncControlScope,
  ControlScope,
  InternalAsyncControl,
  InternalControl,
  UnionToIntersection,
  ParamsUpdatedData,
  ProcessParams,
  Navigation,
  NavigationTarget,
  RouteData,
  RouteMethods,
  RouteParamsData,
  Router,
  NavigationState,
  Route,
  AnyPaths,
} from '../types';
import createControlScope from '../createControlScope';
import noop from 'lodash.noop';
import createSimpleControl from '../utils/createSimpleControl';
import {
  ROOT,
  ROUTE_METHODS,
  ROUTE_PARAMS,
  EMPTY_OBJECT,
  EMPTY_STRING,
  EMPTY_ARR,
} from '../utils/constants';
import concat from '../utils/concat';
import createScope from '../utils/createScope';
import getAsyncControl from '../utils/getAsyncControl';
import { set } from '../utils/control/scope';
import load from '../load';
import alwaysFalse from '../utils/alwaysFalse';
import NOT_FOUND from '../NOT_FOUND';
import prepend from '../utils/prepend';

type HistoryState = { idx?: number; scroll?: [x: number, y: number] };

let popStateListener: undefined | ((e: PopStateEvent) => void);

const getEmptyString = () => EMPTY_STRING;

const handleHref = (
  routes: RouteData[],
  updatedParams?: RouteParamsData[],
  maxControls?: number,
  isMutableOrUseParams?: true | ((route: RouteData) => void),
  useNoop?: () => void
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
          _currentPath: nextPath,
          _currentSearch: nextSearch,
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
      handleParamUpdates(updateQueue);
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

const handleParamUpdates = (queue: ParamsUpdatedData[]) => {
  for (let i = 0; i < queue.length; i++) {
    const { _route, _currentPath, _currentSearch, _params } = queue[i];

    const control = _route._params!;

    _route._currentPath = _currentPath;

    _route._currentSearch = _currentSearch;

    control._set(_params);
  }
};

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

  const handleRoutes = (
    routes: Route<any, any, any>,
    navigations: Record<string, Navigation<AnyPaths, any>>,
    paths: AnyPaths,
    findCurrentRouteArr: Array<(path: string, search: string) => boolean>,
    dataQueue: RouteData[][],
    data: RouteData[],
    controls: ControlScope[],
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
        params: Record<string, any>,
        stringifiedParams: Record<string, string>,
        source: any
      ) {
        let updated = false;

        for (let i = 0; i < this.length; i++) {
          const key = this[i];

          const item = params[key];

          if (key in stringifiedParams || item === undefined) {
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
          } else {
            target[key] = item;
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
        _replaceDeprecatedQueryParams,
        _source,
      } = paths[key];

      const pathParamsCount = _pathParams.length;

      const queryParamsCount = _queryParams.length;

      const l = _path.length;

      const path0 = _path[0];

      const isMatchedControl = createSimpleControl(false) as unknown as Route<
        any,
        any,
        any
      >;

      const isMatchedRoot = isMatchedControl[ROOT];

      const paramsControl: ControlScope<any> | AsyncControlScope<any> | null =
        pathParamsCount || queryParamsCount
          ? _source
            ? (createScope(
                getAsyncControl(
                  set,
                  EMPTY_OBJECT,
                  _source._load && (() => load(_source))
                )
              ) as AsyncControlScope<any>)
            : createControlScope()
          : null;

      const paramsRoot = paramsControl && paramsControl[ROOT];

      const currControls = paramsControl
        ? prepend(controls, paramsControl)
        : controls;

      const regexStr =
        parentRegexStr + (pathParamsCount ? `(${_regexStr})` : _regexStr);

      const routeData: RouteData = {
        _pathParamsCount: pathParamsCount,
        _currentPath: pathParamsCount || !l ? '' : path0,
        _currentSearch: '',
        _selfIndex: data.length,
        _getPath: pathParamsCount
          ? (params, stringifiedParams) => {
              let str = '';

              for (let i = 0; i < l; i++) {
                const item = _path[i];

                if (item[0] == '/') {
                  str += item;
                } else {
                  let value;

                  if (item in stringifiedParams) {
                    value = stringifiedParams[item] || undefined;
                  } else {
                    const param = params[item];

                    value = _getStringify(item)(
                      param !== '' ? param : undefined,
                      item
                    );
                  }

                  if (value !== undefined) {
                    str += '/' + value;
                  }
                }
              }

              return str;
            }
          : l
            ? () => path0
            : getEmptyString,
        _getSearch: queryParamsCount
          ? (params, stringifiedParams) => {
              let search = '';

              for (let i = 0; i < queryParamsCount; i++) {
                const name = _queryParams[i];

                let value;

                if (name in stringifiedParams) {
                  value = stringifiedParams[name] || undefined;
                } else {
                  const param = params[name];

                  value = _getStringify(name)!(
                    param !== '' ? param : undefined,
                    name
                  );
                }

                if (value !== undefined) {
                  if (search) {
                    search += `&${name}=${encodeURIComponent(value)}`;
                  } else {
                    search = `${name}=${encodeURIComponent(value)}`;
                  }
                }
              }

              return search;
            }
          : getEmptyString,
        _extractPathParams: pathParamsCount
          ? extractParams.bind(_pathParams)
          : alwaysFalse,
        _extractQueryParams: queryParamsCount
          ? extractParams.bind(_queryParams)
          : alwaysFalse,
        _replaceDeprecatedQueryParams,
        _isMatched: isMatchedRoot,
        _params: paramsRoot,
        _source,
        _load: noop,
        _unload: noop,
      };

      const _withPathParams = withPathParams || !!pathParamsCount;

      const routesData = concat(data, routeData);

      let _paramsCount = paramsCount;

      let navigation: (
        this: NavigationTarget<boolean>,
        params?: null | ProcessParams<Record<string, any>>,
        stringifiedPrams?: Record<string, string>
      ) => NavigationTarget<boolean>;

      isMatchedControl[ROUTE_METHODS] = (load) => {
        routeData._load = function () {
          const res = load(...currControls);

          if (res) {
            this._unload = function () {
              for (let i = 0; i < res.length; i++) {
                res[i]();
              }

              this._unload = noop;
            };
          }
        };

        if (routeData._isMatched._value) {
          routeData._load();
        }
      };

      if (
        (pathParamsCount || queryParamsCount) &&
        ++_paramsCount > maxParamsPerRoute
      ) {
        maxParamsPerRoute = _paramsCount;
      }

      if (paramsControl) {
        isMatchedControl[ROUTE_PARAMS] = paramsControl;
      }

      if (_children) {
        const childrenNavigation = {};

        handleRoutes(
          isMatchedControl,
          childrenNavigation,
          _children,
          findCurrentRouteArr,
          dataQueue,
          routesData,
          currControls,
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
              onClick
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
                onClick
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

          navigation = function (params, stringifiedPrams) {
            return (
              params !== undefined
                ? {
                    ...childrenNavigation,
                    [ROUTE_METHODS]: methods,
                    [ROUTE_PARAMS]:
                      ROUTE_PARAMS in this
                        ? concat(this[ROUTE_PARAMS]!, {
                            _params: params,
                            _stringifiedParams: stringifiedPrams,
                            _route: routeData,
                          })
                        : [
                            {
                              _params: params,
                              _stringifiedParams: stringifiedPrams,
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
          navigation = function (this: NavigationTarget<boolean>) {
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
            onClick
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
              onClick
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

        (isMatchedControl as any as Route)._register = (_setComponents) => {
          if (currentRouteIndex == routeIndex) {
            _setComponents();
          }

          setComponents = _setComponents;
        };

        navigation = paramsControl
          ? function (params, stringifiedPrams) {
              return (
                params !== undefined
                  ? {
                      [ROUTE_METHODS]: methods,
                      [ROUTE_PARAMS]:
                        ROUTE_PARAMS in this
                          ? concat(this[ROUTE_PARAMS]!, {
                              _params: params,
                              _stringifiedParams: stringifiedPrams,
                              _route: routeData,
                            })
                          : [
                              {
                                _params: params,
                                _stringifiedParams: stringifiedPrams,
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
          : function () {
              return (
                ROUTE_PARAMS in this
                  ? {
                      [ROUTE_METHODS]: methods,
                      [ROUTE_PARAMS]: this[ROUTE_PARAMS]!,
                    }
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

                  const pathParams = _withPathParams
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

                      if (
                        !source ||
                        source[ROOT]._isLoadedControl[ROOT]._value
                      ) {
                        const value = source && source._get();

                        const params = {};

                        let paramsWasReplaced =
                          route._replaceDeprecatedQueryParams(searchParams);

                        try {
                          if (
                            route._extractPathParams(
                              params,
                              EMPTY_OBJECT,
                              pathParams,
                              value
                            )
                          ) {
                            paramsWasReplaced = true;
                          }

                          if (
                            route._extractQueryParams(
                              params,
                              EMPTY_OBJECT,
                              searchParams,
                              value
                            )
                          ) {
                            paramsWasReplaced = true;
                          }
                        } catch (err) {
                          paramsWasReplaced = false;

                          if (source) {
                            (
                              paramsControl as InternalAsyncControl
                            )._errorControl[ROOT]._set(err);

                            continue;
                          }

                          return true;
                        }

                        if (paramsWasReplaced) {
                          isUrlChanged = true;

                          currentParamsQueue.push({
                            _currentPath: route._getPath(params, EMPTY_OBJECT),
                            _currentSearch: route._getSearch(
                              params,
                              EMPTY_OBJECT
                            ),
                            _params: params,
                            _route: route,
                          });
                        } else {
                          currentParamsQueue.push({
                            _currentPath: currentPath,
                            _currentSearch: route._getSearch(
                              EMPTY_OBJECT,
                              searchParams
                            ),
                            _params: params,
                            _route: route,
                          });
                        }
                      } else {
                        currentParamsQueue.push({
                          _currentPath: currentPath,
                          _currentSearch: route._getSearch(
                            EMPTY_OBJECT,
                            searchParams
                          ),
                          _params: undefined!,
                          _route: route,
                        });

                        const unlistenAll = () => {
                          unlistenMatch();

                          unlistenParams();

                          unlistenSource();
                        };

                        const unlistenParams =
                          paramsControl._subscribe(unlistenAll);

                        const unlistenMatch = route._isMatched._subscribe(
                          (value) => {
                            if (!value) {
                              unlistenAll();
                            }
                          }
                        );

                        const unlistenSource = source[ROOT]._subscribeWithError(
                          () => {
                            unlistenAll();

                            if (route._isMatched._value) {
                              const value = source._get();

                              const params = {};

                              let paramsWasReplaced =
                                route._replaceDeprecatedQueryParams(
                                  searchParams
                                );

                              try {
                                if (
                                  route._extractPathParams(
                                    params,
                                    EMPTY_OBJECT,
                                    pathParams,
                                    value
                                  )
                                ) {
                                  paramsWasReplaced = true;
                                }

                                if (
                                  route._extractQueryParams(
                                    params,
                                    EMPTY_OBJECT,
                                    searchParams,
                                    value
                                  )
                                ) {
                                  paramsWasReplaced = true;
                                }
                              } catch (err) {
                                (
                                  paramsControl as InternalAsyncControl
                                )._errorControl[ROOT]._set(err);

                                return;
                              }

                              if (paramsWasReplaced) {
                                history.replaceState(
                                  history.state,
                                  '',
                                  handleHref(
                                    routesQueue[currentRouteIndex],
                                    [{ _params: params, _route: route }],
                                    0,
                                    true
                                  )
                                );
                              } else {
                                paramsControl._set(params);
                              }
                            }
                          }
                        );
                      }
                    }

                    handleParamUpdates(currentParamsQueue);
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

      (routes as any)[key] = isMatchedControl;

      navigations[key] = navigation as Navigation<any, any, any, any>;
    }
  };

  const handleMatching = (
    nextRoutes: RouteData[],
    setComponents: () => void
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
              nextRoute._isMatched._set(true);

              nextRoute._load();
            }

            if (currRoute) {
              currRoute._isMatched._set(false);

              currRoute._unload();

              if (currRoute._params) {
                currRoute._params._value = undefined;
              }
            }
          }
        }
      }
    } else {
      for (let i = 0; i < nextRoutes.length; i++) {
        nextRoutes[i]._isMatched._set(true);
      }
    }

    setComponents();
  };

  const navigate = (
    index: number,
    routes: RouteData[],
    setComponents: () => void,
    event: ReactMouseEvent<HTMLAnchorElement, any> | null,
    params: RouteParamsData[] | undefined,
    replace: boolean | undefined,
    ignoreBlock: boolean | undefined,
    enableScrollToTop: boolean | undefined,
    enableScrollRestoration: boolean | undefined,
    onClick:
      | ((event: ReactMouseEvent<HTMLAnchorElement, any>) => void)
      | undefined
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
      const state = history.state;

      const isNewPage = currentRouteIndex != index;

      const href = handleHref(routes, params, 0, true);

      handleMatching(routes, setComponents);

      currentRouteIndex = index;

      if (replace) {
        history.replaceState(state, '', href);

        navigationStateRoot._set({
          action: 'replace',
          delta: 0,
        });
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

        navigationStateRoot._set({
          action: 'push',
          delta: 1,
        });
      }

      if (enableScrollToTop == null ? isNewPage : enableScrollToTop) {
        window.scroll(0, 0);
      }
    };

    if (isRouterAvailable || ignoreBlock) {
      fn();
    } else {
      allowNavigate = fn;

      isLeaveControl._set(true);
    }
  };

  const routesQueue: RouteData[][] = [];

  const findCurrentRouteArr: Array<(path: string, search: string) => boolean> =
    [];

  const isLeaveControl: InternalControl<boolean> =
    createSimpleControl<boolean>(false)[ROOT];

  const navigationControlState = createSimpleControl<NavigationState>({
    action: 'none',
    delta: 0,
  });

  const navigationStateRoot: InternalControl<NavigationState> =
    navigationControlState[ROOT];

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

      isLeaveControl._set(true);
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
        delta = 0;
      }

      isRouterBlockPopupAllowed = true;

      navigationStateRoot._set({ action: 'pop', delta });

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
    EMPTY_ARR,
    '',
    0,
    false
  );

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
        [ROOT]: isLeaveControl,
        allow() {
          isLeaveControl._set(false);

          allowNavigate();

          allowNavigate = noop;
        },
        deny() {
          isLeaveControl._set(false);

          allowNavigate = noop;
        },
      } as Router<any>['navigationBlocker']['isPendingNavigation'],
    },
  };
};

export default createRouter;
