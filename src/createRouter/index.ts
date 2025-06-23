import {
  useSyncExternalStore,
  type FC,
  type PropsWithChildren,
  type ComponentType,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
} from 'react';
import type {
  AsyncControl,
  AsyncControlScope,
  InternalAsyncControl,
  InternalControl,
  Mutable,
  ReadonlyAsyncControlScope,
  ReadonlyControl,
  ReadonlyControlScope,
} from '../types';
import createControlScope from '../createControlScope';
import noop from 'lodash.noop';
import createSimpleControl from '../utils/createSimpleControl';
import identity from 'lodash.identity';
import {
  BLOCK_ROUTER,
  ROOT,
  ROUTE_METHODS,
  ROUTE_PARAMS,
  ROUTER,
  EMPTY_OBJECT,
  UNBLOCK_ROUTER,
  EMPTY_STRING,
  EMPTY_ARR,
} from '../utils/constants';
import { jsx } from 'react/jsx-runtime';
import concat from '../utils/concat';
import alwaysNoop from '../utils/alwaysNoop';
import alwaysTrue from '../utils/alwaysTrue';
import { postBatchCallbacksPush, scheduleBatch } from '../utils/batching';
import createScope from '../utils/createScope';
import getAsyncControl from '../utils/getAsyncControl';
import { set } from '../utils/control/scope';
import load from '../load';

type HistoryState = { idx?: number; scroll?: [x: number, y: number] };

let popStateListener: undefined | ((e: PopStateEvent) => void);

let unloads: Array<() => void> = EMPTY_ARR;

const getEmptyString = () => EMPTY_STRING;

const parseArray = (value: string) => value.split('/');

const stringifyArray = (value: string[], key: string) => {
  if (!value.length) {
    throw new Error(`${key} is empty`);
  }

  return value.join('/');
};

const useParam = (route: RouteData) => {
  const control = route._params!;

  if ('_subscribeWithError' in control) {
    const errorControl = control._errorControl[ROOT];

    if (errorControl._value !== undefined) {
      throw errorControl._value;
    }

    useSyncExternalStore(
      control._subscribeWithError,
      () =>
        errorControl._value === undefined &&
        route._currentPath + '?' + route._currentSearch
    );
  } else {
    useSyncExternalStore(control._subscribe, () => control._valueToggler);
  }
};

const handleHref = (
  routes: RouteData[],
  updatedParams: RouteParams[] | undefined,
  maxControls: number,
  isMutable?: true
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
        useParam(route);

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
    const updateQueue = isMutable && ([] as ParamsUpdatedData[]);

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
      const { _route: route, _params, _stringifiedParams } = updatedParams[i];

      const max = route._selfIndex;

      for (; routeIndex < max; routeIndex++) {
        handleRoute(routes[routeIndex]);
      }

      let params =
        typeof _params == 'object'
          ? _params || EMPTY_OBJECT
          : _params!(route._params!._value);

      const nextSearch = route._getSearch(
        params,
        _stringifiedParams || EMPTY_OBJECT
      );

      const nextPath = route._getPath(
        params,
        _stringifiedParams || EMPTY_OBJECT
      );

      if (updateQueue) {
        if (_stringifiedParams) {
          params = { ...params };

          route._extractParams(
            params,
            _stringifiedParams,
            route._source && route._source._get()
          );
        }

        updateQueue.push({
          _route: route,
          _currentPath: nextPath,
          _currentSearch: nextSearch,
          _params: params,
        });
      } else if (maxControls) {
        if (typeof _params == 'function') {
          useParam(route);
        } else {
          useSyncExternalStore(alwaysNoop, noop);
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
      useSyncExternalStore(alwaysNoop, noop);
    }
  }

  return (path || '/') + search;
};

const handleParamUpdates = (queue: ParamsUpdatedData[]) => {
  for (let i = 0; i < queue.length; i++) {
    const { _route, _currentPath, _currentSearch, _params } = queue[i];

    _route._currentPath = _currentPath;

    _route._currentSearch = _currentSearch;

    _route._params!._set(_params);
  }
};

const nonUndefinedIdentity = (value: any, key: string) => {
  if (value === undefined) {
    throw new Error(`${key} is required`);
  }

  return value;
};

const beforeUnloadListener = (e: BeforeUnloadEvent) => {
  e.preventDefault();

  e.returnValue = true;
};

const handleStringify = (
  stringify: ((value: any) => string) | undefined,
  optional: boolean | undefined,
  defaultValue: undefined | unknown | (() => unknown)
): typeof nonUndefinedIdentity => {
  if (optional) {
    const getDefaultValue =
      defaultValue !== undefined &&
      (typeof defaultValue != 'function' ? () => defaultValue : defaultValue);

    return stringify
      ? getDefaultValue
        ? (value) => stringify(value !== undefined ? value : getDefaultValue())
        : (value) => (value !== undefined ? stringify(value) : value)
      : getDefaultValue
        ? (value) => (value !== undefined ? value : getDefaultValue())
        : identity;
  }

  return stringify
    ? (value, key) => stringify(nonUndefinedIdentity(value, key))
    : nonUndefinedIdentity;
};

const createRouter = <Routes extends Record<string, () => RouteBase<boolean>>>(
  options: ToOptions<[]> & {
    Container?: ComponentType<PropsWithChildren>;
    NotFound: ComponentType;
    getRoutes(createRoute: () => PathCreator & AsyncRoute): Routes;
  }
): UnionToIntersection<Routes> & Router => {
  if (popStateListener) {
    window.removeEventListener('popstate', popStateListener);
  }

  for (let i = 0; i < unloads.length; i++) {
    unloads[i]();
  }

  unloads = EMPTY_ARR;

  let isRouterAvailable = true;

  let getBlockedRouterMessage = getEmptyString;

  let nestingIndex = 0;

  let maxParamsPerRoute = 0;

  let currentRouteIndex = -1;

  let paramsWasReplaced = false;

  const { NotFound, load: _load, Container } = options;

  const pathQueue: string[] = [];

  const routesQueue: RouteData[][] = [];

  const componentsQueue: ComponentType[][] = [];

  const nestingLevels = new Map<number, number[]>();

  const routerComponentsList: ComponentType[][] = [];

  const handleParse = (
    name: string,
    optional: boolean | undefined,
    parse: ((value: string | undefined, source: any) => any) | undefined,
    isValid: ((value: any, source: any) => boolean) | undefined,
    defaultValue: undefined | unknown | ((source: any) => unknown),
    fallbackValue: undefined | unknown | ((source: any) => unknown)
  ): ((value: string | undefined, source: any, key: string) => any) => {
    parse ||= identity;

    isValid ||= alwaysTrue;

    const getFallbackValue: (
      incorrectValue: string | undefined,
      source: any,
      error?: any
    ) => any =
      typeof fallbackValue != 'function'
        ? optional || fallbackValue !== undefined
          ? () => {
              paramsWasReplaced = true;

              return fallbackValue;
            }
          : (_, __, error) => {
              throw error || new Error(`${name} is not valid`);
            }
        : (arg, source) => {
            paramsWasReplaced = true;

            return fallbackValue(arg, source);
          };

    const getDefaultValue =
      defaultValue !== undefined &&
      (typeof defaultValue != 'function'
        ? () => {
            paramsWasReplaced = true;

            return defaultValue;
          }
        : (source: any) => {
            paramsWasReplaced = true;

            return defaultValue(source);
          });

    const safeParse = (value: string | undefined, source: any, key: string) => {
      try {
        const parsed = parse(nonUndefinedIdentity(value, key), source);

        return isValid(parsed, source)
          ? parsed
          : getFallbackValue(value, source);
      } catch (error) {
        return getFallbackValue(value, source, error);
      }
    };

    return optional
      ? getDefaultValue
        ? (value, source, key) =>
            value ? safeParse(value, source, key) : getDefaultValue(source)
        : (value, source, key) => value && safeParse(value, source, key)
      : safeParse;
  };

  const handleMatching = (
    nextRoutes: RouteData[],
    componentList: ComponentType[]
  ) => {
    if (currentRouteIndex > 0) {
      const currentRoutes = routesQueue[currentRouteIndex];

      if (currentRoutes != nextRoutes) {
        const maxLength = Math.max(nextRoutes.length, currentRoutes.length);

        for (let i = 0; i < maxLength; i++) {
          const currRoute = currentRoutes[i];

          const nextRoute = nextRoutes[i];

          if (currRoute != nextRoute) {
            if (nextRoute) {
              nextRoute._load();

              nextRoute._isMatched._set(true);
            }

            if (currRoute) {
              const unloads = currRoute._unloads;

              currRoute._isMatched._set(false);

              for (let i = 0; i < unloads.length; i++) {
                unloads[i]();
              }

              currRoute._unloads = EMPTY_ARR;
            }
          }
        }
      }
    } else {
      for (let i = 0; i < nextRoutes.length; i++) {
        const route = nextRoutes[i];

        route._load();

        route._isMatched._set(true);
      }
    }

    for (let i = 0; i < componentList.length; i++) {
      setControlArr[i](componentList[i]);
    }
  };

  const navigate = (
    index: number,
    routes: RouteData[],
    componentList: ComponentType[],
    event: ReactMouseEvent<HTMLAnchorElement, any> | null,
    params: RouteParams[] | undefined,
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

      const el = event.currentTarget;

      const { target } = el;

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

    if (
      isRouterAvailable ||
      ignoreBlock ||
      window.confirm(getBlockedRouterMessage())
    ) {
      const state = history.state;

      const isNewPage = currentRouteIndex != index;

      const href = handleHref(routes, params, 0, true);

      handleMatching(routes, componentList);

      currentRouteIndex = index;

      if (replace) {
        history.replaceState(state, '', href);

        locationControl._set({
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

        locationControl._set({
          action: 'push',
          delta: 1,
        });
      }

      if (enableScrollToTop == null ? isNewPage : enableScrollToTop) {
        window.scroll(0, 0);
      }
    }
  };

  const router = options.getRoutes(() => {
    let asyncSourceControl: InternalAsyncControl | undefined;

    let regexStr = '';

    const path: string[] = [];

    const pathParams: string[] = [];

    const queryParams: string[] = [];

    const parsers = new Map<
      string,
      (value: string | undefined, source: any, key: string) => any
    >();

    const stringifies = new Map<
      string,
      (value: any, key: string) => string | undefined
    >();

    let deprecatedKeys: string[] | undefined;

    let deprecatedMapper:
      | ((
          values: Partial<Record<string, string>>
        ) => Partial<Record<string, any>>)
      | undefined;

    const currentPathQueueIndex = pathQueue.length;

    const currentNestingIndex = nestingIndex++;

    return {
      to(
        options: ToOptions<[any]> &
          (
            | {
                Container?: ComponentType<PropsWithChildren>;
                routes: Record<string, () => RouteBase<boolean>>;
              }
            | { Component: ComponentType }
          )
      ) {
        const { load: _load } = options;

        const l = path.length;

        const path0 = path[0];

        const pathParamsCount = pathParams.length;

        const queryParamsCount = queryParams.length;

        const getStringify = stringifies.get.bind(stringifies);

        const getParse = parsers.get.bind(parsers);

        const isMatchedControl = createSimpleControl(false);

        const isMatchedRoot = isMatchedControl[ROOT];

        const paramsControl =
          pathParamsCount || queryParamsCount
            ? asyncSourceControl
              ? (createScope(
                  getAsyncControl(
                    set,
                    {},
                    asyncSourceControl._load &&
                      (() => load(asyncSourceControl!))
                  )
                ) as AsyncControlScope<unknown>)
              : createControlScope()
            : null;

        const paramsRoot = paramsControl && paramsControl[ROOT];

        const routeData: RouteData = {
          _load: _load
            ? function (this: RouteData) {
                const res = _load(paramsRoot && paramsRoot._value);

                this._unloads = res
                  ? typeof res == 'object'
                    ? res
                    : [res]
                  : EMPTY_ARR;
              }
            : noop,
          _unloads: EMPTY_ARR,
          _pathParamsCount: pathParamsCount,
          _currentPath: pathParamsCount || !l ? '' : path0,
          _currentSearch: '',
          _selfIndex: currentNestingIndex,
          _extractParams:
            pathParamsCount || queryParamsCount
              ? (target, stringifiedParams, source) => {
                  for (const key in stringifiedParams) {
                    const parse = getParse(key);

                    if (parse) {
                      target[key] = parse(
                        stringifiedParams[key] || undefined,
                        source,
                        key
                      );
                    }
                  }
                }
              : noop,
          _getPath: pathParamsCount
            ? (params, stringifiedParams) => {
                let str = '';

                for (let i = 0; i < l; i++) {
                  const item = path[i];

                  if (item[0] == '/') {
                    str += item;
                  } else {
                    let value;

                    if (item in stringifiedParams) {
                      value = stringifiedParams[item] || undefined;
                    } else {
                      const param = params[item];

                      value = getStringify(item)!(
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
                  const name = queryParams[i];

                  let value;

                  if (name in stringifiedParams) {
                    value = stringifiedParams[name] || undefined;
                  } else {
                    const param = params[name];

                    value = getStringify(name)!(
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
            ? (target, params, source) => {
                for (let i = 0; i < pathParamsCount; i++) {
                  const key = pathParams[i];

                  target[key] = getParse(key)!(
                    params[key] || undefined,
                    source,
                    key
                  );
                }
              }
            : noop,
          _extractQueryParams: queryParamsCount
            ? (target, params, source) => {
                for (let i = 0; i < queryParamsCount; i++) {
                  const key = queryParams[i];

                  target[key] = getParse(key)!(
                    params[key] || undefined,
                    source,
                    key
                  );
                }
              }
            : noop,
          _replaceDeprecatedQueryParams: deprecatedKeys
            ? (searchParams) => {
                let replaced = false;

                const obj: Record<string, string> = {};

                for (let i = 0; i < deprecatedKeys!.length; i++) {
                  const key = deprecatedKeys![i];

                  const value = searchParams[key];

                  if (value) {
                    replaced = true;

                    obj[key] = value;
                  }
                }

                if (replaced) {
                  paramsWasReplaced = true;

                  try {
                    const params = deprecatedMapper!(obj);

                    for (const key in params) {
                      if (!(key in searchParams)) {
                        const param = params[key];

                        try {
                          const value = getStringify(key)!(param, key);

                          if (value) {
                            searchParams[key] = value;
                          }
                        } catch {}
                      }
                    }
                  } catch {}
                }
              }
            : noop,
          _isMatched: isMatchedRoot,
          _params: paramsRoot,
          _source: asyncSourceControl,
        };

        let route: (
          this: RouteBase<boolean>,
          params?: null | ProcessParams<Record<string, any>>,
          stringifiedPrams?: Record<string, string>
        ) => RouteBase<boolean>;

        if (paramsRoot && _load) {
          let unlisten = noop;

          isMatchedRoot._subscribe((isMatched) => {
            if (isMatched) {
              unlisten = paramsRoot._subscribe(() => {
                if (isMatchedRoot._value) {
                  const unloads = routeData._unloads;

                  routeData._load();

                  for (let i = 0; i < unloads.length; i++) {
                    unloads[i]();
                  }
                }
              });
            } else {
              unlisten();

              unlisten = noop;
            }
          });
        }

        if ('Component' in options) {
          const routes = new Array<RouteData>(nestingIndex);

          const componentList: ComponentType[] = [];

          const routeIndex = pathQueue.length;

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
                routes,
                componentList,
                event,
                params,
                replace,
                ignoreBlock,
                enableScrollToTop,
                enableScrollRestoration,
                onClick
              );
            },
            _useHref: (params) => handleHref(routes, params, maxParamsPerRoute),
            _isMatched: isMatchedRoot,
          };

          const res = {
            [ROUTE_METHODS]: methods,
          } as RouteBase<boolean>;

          routes[currentNestingIndex] = routeData;

          pathQueue.push(regexStr);

          routesQueue.push(routes);

          componentsQueue.push([options.Component]);

          routerComponentsList.push(componentList);

          route = paramsControl
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
                ) as RouteBase<boolean>;
              }
            : function () {
                return (
                  ROUTE_PARAMS in this
                    ? {
                        [ROUTE_METHODS]: methods,
                        [ROUTE_PARAMS]: this[ROUTE_PARAMS]!,
                      }
                    : res
                ) as RouteBase<boolean>;
              };
        } else {
          const { Container, routes } = options;

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
                routesQueue[currentRouteIndex],
                routerComponentsList[currentRouteIndex],
                event,
                params,
                replace,
                ignoreBlock,
                enableScrollToTop,
                enableScrollRestoration,
                onClick
              );
            },
            _useHref: (params) =>
              handleHref(
                routesQueue[currentRouteIndex],
                params,
                maxParamsPerRoute
              ),
            _isMatched: isMatchedRoot,
          };

          for (let i = currentPathQueueIndex; i < pathQueue.length; i++) {
            pathQueue[i] =
              (pathParamsCount ? `(${regexStr})` : regexStr) + pathQueue[i];

            routesQueue[i][currentNestingIndex] = routeData;

            if (Container) {
              const components = componentsQueue[i];

              const l = components.length;

              if (nestingLevels.has(l)) {
                nestingLevels.get(l)!.push(i);
              } else {
                nestingLevels.set(l, [i]);
              }

              components.push(Container);
            }
          }

          route = paramsControl
            ? function (params, stringifiedPrams) {
                return (
                  params !== undefined
                    ? {
                        ...routes,
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
                          ...routes,
                          [ROUTE_PARAMS]: this[ROUTE_PARAMS],
                        }
                      : routes
                ) as RouteBase<boolean>;
              }
            : function (this: RouteBase<boolean>) {
                return (
                  ROUTE_PARAMS in this
                    ? {
                        ...routes,
                        [ROUTE_PARAMS]: this[ROUTE_PARAMS]!,
                      }
                    : routes
                ) as RouteBase<boolean>;
              };
        }

        if (paramsControl) {
          (route as unknown as Mutable<Route<any, any>>).params =
            paramsControl as any;
        }

        (route as unknown as Mutable<Route<any, any>>).isMatched =
          isMatchedControl;

        nestingIndex--;

        return route as any;
      },
      async(source) {
        asyncSourceControl = source[ROOT];

        return this as any;
      },
      segment(text: string) {
        text = '/' + text;

        const l = path.length;

        if (l && path[l - 1][0] == '/') {
          path[l - 1] += text;
        } else {
          path.push(text);
        }

        regexStr += text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        return this;
      },
      param(
        name,
        {
          parse,
          stringify,
          isValid = alwaysTrue,
          optional,
          fallbackValue,
          defaultValue,
        }: ParamOptions<unknown, unknown, boolean, [any]> = {}
      ) {
        const pattern = `/(?<${name}>[^/]+)`;

        parsers.set(
          name,
          handleParse(
            name,
            optional,
            parse,
            isValid,
            defaultValue,
            fallbackValue
          )
        );

        regexStr += optional ? `(?:${pattern})?` : pattern;

        stringifies.set(
          name,
          handleStringify(stringify, optional, defaultValue)
        );

        path.push(name);

        pathParams.push(name);

        return this as any;
      },
      array(name, converter) {
        const stringify = converter && converter.stringify;

        regexStr += `(?:/(?<${name}>(?:[^/]+(?:/[^/]+)*)))?`;

        parsers.set(
          name,
          (converter && converter.parse) || (parseArray as any)
        );

        stringifies.set(
          name,
          stringify
            ? (value, name) => stringifyArray(stringify(value), name)
            : stringifyArray
        );

        path.push(name);

        pathParams.push(name);

        return this as any;
      },
      oneOf(
        name: string,
        variants: string[],
        optional?: boolean,
        defaultValue?: string
      ) {
        const pattern = `/(?<${name}>(?:${variants
          .map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('|')}))`;

        const set = new Set(variants);

        const isCorrectVariant = set.has.bind(set);

        regexStr += optional ? `(?:${pattern})?` : pattern;

        parsers.set(
          name,
          optional && defaultValue ? (value) => value || defaultValue : identity
        );

        stringifies.set(
          name,
          optional
            ? (value, key) => {
                value ||= defaultValue;

                if (value === undefined || isCorrectVariant(value)) {
                  return value;
                }

                throw new Error(`${key} has incorrect "${value}" variant`);
              }
            : (value, key) => {
                if (isCorrectVariant(nonUndefinedIdentity(value, key))) {
                  return value;
                }

                throw new Error(`${key} has incorrect "${value}" variant`);
              }
        );

        path.push(name);

        pathParams.push(name);

        return this;
      },
      query(
        name,
        {
          parse,
          stringify,
          isValid = alwaysTrue,
          optional,
          fallbackValue,
          defaultValue,
        }: ParamOptions<unknown, unknown, boolean, [any]> = {}
      ) {
        parsers.set(
          name,
          handleParse(
            name,
            optional,
            parse,
            isValid,
            defaultValue,
            fallbackValue
          )
        );

        stringifies.set(
          name,
          handleStringify(stringify, optional, defaultValue)
        );

        queryParams.push(name);

        return this as any;
      },
      deprecatedQuery(keys, mapper) {
        deprecatedKeys = keys;

        deprecatedMapper = mapper;

        return this as any;
      },
    } as PathCreator<any, any> &
      Partial<PathAfterDeprecatedQuery<any, any>> &
      AsyncRoute;
  }) as Routes & Router;

  const pathQueueSize = pathQueue.length;

  const findCurrentRouteArr = new Array<
    (path: string, search: string) => boolean
  >(pathQueueSize);

  const setControlArr: Array<(component: ComponentType) => void> = [];

  const { pathname, search } = location;

  const locationControl: InternalControl<RouterLocation> =
    createSimpleControl<RouterLocation>({ action: 'none', delta: 0 })[ROOT];

  const handleRouter = () => {
    let onValueChange: () => void = noop;

    let CurrentComponent: ComponentType = noop as any;

    const subscribe = (_onValueChange: () => void) => {
      onValueChange = () => {
        postBatchCallbacksPush(() => {
          _onValueChange();
        });

        scheduleBatch();
      };

      return () => {
        _onValueChange = onValueChange = noop;
      };
    };

    const getComponent = () => CurrentComponent;

    setControlArr.push((component) => {
      CurrentComponent = component;

      onValueChange();
    });

    return () =>
      jsx(useSyncExternalStore(subscribe, getComponent), EMPTY_OBJECT);
  };

  const Router = handleRouter();

  router[ROUTER] = Container
    ? () => jsx(Container, { children: jsx(Router, EMPTY_OBJECT) })
    : Router;

  router[BLOCK_ROUTER] = (message) => {
    isRouterAvailable = false;

    getBlockedRouterMessage =
      typeof message == 'string' ? () => message : message;

    window.addEventListener('beforeunload', beforeUnloadListener);

    return router[UNBLOCK_ROUTER];
  };

  router[UNBLOCK_ROUTER] = () => {
    isRouterAvailable = true;

    getBlockedRouterMessage = getEmptyString;

    window.removeEventListener('beforeunload', beforeUnloadListener);
  };

  router[ROOT] = locationControl;

  for (let i = nestingLevels.size; i > 0; i--) {
    const map = new Map<ComponentType, FC>();

    const level = nestingLevels.get(i)!;

    const Router = handleRouter();

    for (let j = 0; j < level.length; j++) {
      const index = level[j];

      const Container = componentsQueue[index][i];

      if (!map.has(Container)) {
        map.set(Container, () =>
          jsx(Container, { children: jsx(Router, EMPTY_OBJECT) })
        );
      }

      routerComponentsList[index].push(map.get(Container)!);
    }
  }

  let currentHistoryIndex = 0;

  const state = history.state as HistoryState | null;

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

  for (let i = 0; i < pathQueueSize; i++) {
    const regex = new RegExp(`^${pathQueue[i] || '/'}$`);

    const routes = routesQueue[i];

    const components = routerComponentsList[i];

    let paramsCount = 0;

    let withPathParams = false;

    components.push(componentsQueue[i][0]);

    for (let i = 0; i < routes.length; i++) {
      const route = routes[i];

      if (route._params) {
        paramsCount++;

        if (route._extractPathParams != noop) {
          withPathParams = true;
        }
      }
    }

    if (paramsCount > maxParamsPerRoute) {
      maxParamsPerRoute = paramsCount;
    }

    const withParams = !!paramsCount;

    const testRegex = regex[withPathParams ? 'exec' : 'test'].bind(regex);

    findCurrentRouteArr[i] = (path, search) => {
      const isMatched = testRegex(path);

      if (isMatched) {
        if (withParams) {
          const searchParams: Record<string, string> = {};

          const pathParams = withPathParams
            ? (isMatched as RegExpExecArray).groups!
            : EMPTY_OBJECT;

          const currentParamsQueue: ParamsUpdatedData[] = [];

          const updatedParamsQueue: RouteParams[] = [];

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

          for (let i = 0, pathSegmentIndex = 1; i < routes.length; i++) {
            const route = routes[i];

            const paramsControl = route._params;

            if (paramsControl) {
              const source = route._source;

              const currentPath = route._pathParamsCount
                ? (isMatched as RegExpExecArray)[
                    (pathSegmentIndex += route._pathParamsCount)
                  ]
                : route._currentPath;

              if (!source || source[ROOT]._isLoadedControl[ROOT]._value) {
                const value = source && source._get();

                const params = {};

                route._replaceDeprecatedQueryParams(searchParams);

                try {
                  route._extractPathParams(params, pathParams, value);

                  route._extractQueryParams(params, searchParams, value);
                } catch (err) {
                  paramsWasReplaced = false;

                  if (source) {
                    (paramsControl as InternalAsyncControl)._errorControl[
                      ROOT
                    ]._set(err);

                    continue;
                  }

                  return false;
                }

                if (paramsWasReplaced) {
                  paramsWasReplaced = false;

                  updatedParamsQueue.push({ _params: params, _route: route });
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
                  _currentSearch: route._getSearch(EMPTY_OBJECT, searchParams),
                  _params: undefined!,
                  _route: route,
                });

                const unlistenAll = () => {
                  unlistenMatch();

                  unlistenParams();

                  unlistenSource();
                };

                const unlistenParams = paramsControl._subscribe(unlistenAll);

                const unlistenMatch = route._isMatched._subscribe((value) => {
                  if (!value) {
                    unlistenAll();
                  }
                });

                const unlistenSource = source[ROOT]._subscribeWithError(() => {
                  unlistenAll();

                  if (route._isMatched._value) {
                    const value = source._get();

                    const params = {};

                    route._replaceDeprecatedQueryParams(searchParams);

                    try {
                      route._extractPathParams(params, pathParams, value);

                      route._extractQueryParams(params, searchParams, value);
                    } catch (err) {
                      paramsWasReplaced = false;

                      (paramsControl as InternalAsyncControl)._errorControl[
                        ROOT
                      ]._set(err);

                      return;
                    }

                    if (paramsWasReplaced) {
                      paramsWasReplaced = false;

                      history.replaceState(
                        history.state,
                        '',
                        handleHref(
                          routes,
                          [{ _params: params, _route: route }],
                          0,
                          true
                        )
                      );
                    } else {
                      paramsControl._set(params);
                    }
                  }
                });
              }
            }
          }

          handleParamUpdates(currentParamsQueue);

          if (updatedParamsQueue.length) {
            history.replaceState(
              history.state,
              '',
              handleHref(routes, updatedParamsQueue, 0, true)
            );
          }
        }

        handleMatching(routes, components);

        currentRouteIndex = i;
      }

      return !!isMatched;
    };
  }

  if (_load) {
    const res = _load();

    if (res) {
      unloads = typeof res == 'object' ? res : [res];
    }
  }

  for (
    let i = 0;
    i < pathQueueSize && !findCurrentRouteArr[i](pathname, search);
    i++
  ) {}

  if (currentRouteIndex < 0) {
    setControlArr[0](NotFound);
  }

  let delta = 0;

  let isPopTriggeredByBlocking = false;

  let isRouterBlockPopupAllowed = true;

  let isPopTriggeredForScrollSave = false;

  let isPopTriggeredByScrollSaving = false;

  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  popStateListener = (e) => {
    const state = e.state as HistoryState | null;

    const nextHistoryIndex = state && state.idx;

    if (isPopTriggeredByBlocking || isPopTriggeredForScrollSave) {
      if (
        isPopTriggeredByBlocking &&
        !window.confirm(getBlockedRouterMessage())
      ) {
        isPopTriggeredByBlocking = isPopTriggeredForScrollSave = false;

        return;
      }

      if (isPopTriggeredForScrollSave) {
        isPopTriggeredForScrollSave = false;

        isPopTriggeredByScrollSaving = true;

        history.replaceState(
          {
            ...state,
            scroll: [window.scrollX, window.scrollY],
          } satisfies HistoryState,
          ''
        );
      }

      isPopTriggeredByBlocking = isRouterBlockPopupAllowed = false;

      history.go(delta);
    } else if (nextHistoryIndex != currentHistoryIndex) {
      if (nextHistoryIndex != null) {
        const scroll = state && state.scroll;

        delta = nextHistoryIndex - currentHistoryIndex;

        isPopTriggeredByBlocking =
          isRouterBlockPopupAllowed && !isRouterAvailable;

        isPopTriggeredForScrollSave = !!scroll && !isPopTriggeredByScrollSaving;

        if (isPopTriggeredByBlocking || isPopTriggeredForScrollSave) {
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

      locationControl._set({ action: 'pop', delta });

      const { pathname, search } = location;

      for (let i = 0; i < pathQueueSize; i++) {
        if (findCurrentRouteArr[i](pathname, search)) {
          return;
        }
      }

      if (currentRouteIndex > -1) {
        const routes = routesQueue[currentRouteIndex];

        for (let i = routes.length; i--; ) {
          const route = routes[i];

          const unloads = route._unloads;

          route._isMatched._set(false);

          for (let i = 0; i < unloads.length; i++) {
            unloads[i]();
          }

          route._unloads = EMPTY_ARR;
        }

        currentRouteIndex = -1;

        setControlArr[0](NotFound);
      }
    }
  };

  window.addEventListener('popstate', popStateListener);

  return router as any;
};

export default createRouter;

type RouterLocation = {
  readonly action: 'none' | 'push' | 'replace' | 'pop';
  readonly delta: number;
};

export type Router = {
  [ROUTER](): ReactElement;
  [BLOCK_ROUTER](message: string | (() => string)): () => void;
  [UNBLOCK_ROUTER](): void;
} & ReadonlyControl<RouterLocation>;

type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (
  x: infer R
) => void
  ? Required<R>
  : never;

declare const ROUTE_MARKER: unique symbol;

type ParamsUpdatedData = {
  readonly _route: RouteData;
  readonly _params: Record<string, any>;
  readonly _currentPath: string;
  readonly _currentSearch: string;
};

type ParamOptions<Value, DefaultValue, O, Source extends [any?] | [] = []> = {
  stringify?(value: Value): string;
  parse?(value: string, ...args: Source): Value;
  optional?: O;
  isValid?(value: Value, ...args: Source): boolean;
  defaultValue?: DefaultValue | ((...args: Source) => DefaultValue);
  fallbackValue?:
    | Value
    | ((
        incorrectValue: string | (O extends true ? never : undefined),
        ...args: Source
      ) => Value);
};

type RouteData = {
  readonly _selfIndex: number;
  readonly _params: InternalControl | InternalAsyncControl | null;
  readonly _source: InternalAsyncControl | undefined;
  readonly _isMatched: InternalControl<boolean>;
  readonly _pathParamsCount: number;
  _getPath(
    params: Record<string, any>,
    stringifiedParams: Record<string, string>
  ): string;
  _getSearch(
    params: Record<string, any>,
    stringifiedParams: Record<string, string>
  ): string;
  _extractPathParams(
    target: Record<string, any>,
    pathParams: Record<string, any>,
    source: any
  ): void;
  _extractQueryParams(
    target: Record<string, any>,
    searchParams: Record<string, string>,
    source: any
  ): void;
  _replaceDeprecatedQueryParams(searchParams: Record<string, string>): void;
  _extractParams(
    target: Record<string, any>,
    stringifiedParams: Record<string, string>,
    source: any
  ): void;
  _load(): void;
  _unloads: Array<() => void>;
  _currentPath: string;
  _currentSearch: string;
};

type RouteParams = {
  readonly _route: RouteData;
  readonly _params: ProcessParams<Record<string, any>> | null;
  readonly _stringifiedParams?: Record<string, string>;
};

type RouteMethods = {
  _useHref(params: RouteParams[] | undefined): string;
  _navigate(
    event: ReactMouseEvent<HTMLAnchorElement, any> | null,
    params?: RouteParams[],
    replace?: boolean,
    ignoreBlock?: boolean,
    enableScrollToTop?: boolean,
    enableScrollRestoration?: boolean,
    onClick?: (event: ReactMouseEvent<HTMLAnchorElement, any>) => void
  ): void;
  readonly _isMatched: InternalControl<boolean>;
};

export type RouteBase<Navigable extends boolean> = {
  /** @internal */
  readonly [ROUTE_METHODS]: RouteMethods;
  /** @internal */
  readonly [ROUTE_PARAMS]?: RouteParams[];
  [ROUTE_MARKER]: Navigable;
};

type ProcessParams<O> = O | ((prev: O) => O);

export type Route<
  Children extends Record<string, () => RouteBase<boolean>> = {},
  Params = {},
  OptionalParams extends string = never,
  Async extends boolean = false,
> = {
  (): [keyof Children] extends [never]
    ? RouteBase<true>
    : Children & RouteBase<false>;
  readonly isMatched: ReadonlyControl<boolean>;
} & ([keyof Params] extends [never]
  ? {}
  : {
      readonly params: Async extends false
        ? ReadonlyControlScope<Params>
        : ReadonlyAsyncControlScope<Params>;
      (
        params: ProcessParams<
          {
            [key in Exclude<keyof Params, OptionalParams>]: Params[key];
          } & {
            [key in Extract<keyof Params, OptionalParams>]?: Params[key];
          }
        >
      ): Children & RouteBase<true>;
      <
        P extends {
          [key in keyof Params]?: Params[key];
        } = never,
      >(
        params: ProcessParams<P> | null,
        stringifiedParams: {
          [key in Exclude<
            keyof Params,
            OptionalParams | keyof P
          >]: Params[key] extends string ? Params[key] : string;
        } & {
          [key in Extract<
            keyof Params,
            OptionalParams | keyof P
          >]?: NonNullable<Params[key]> extends string ? Params[key] : string;
        }
      ): Children & RouteBase<true>;
    });

type ToOptions<Params extends [any] | []> = {
  load?(...args: Params): (() => void) | Array<() => void> | void;
};

declare class PathBase<
  Params = {},
  OptionalParams extends string = never,
  AsyncSource extends [any?] | [] = [],
> {
  to(
    options: { Component: ComponentType; routes?: undefined } & ToOptions<
      [keyof Params] extends [never]
        ? []
        : [
            params:
              | Params
              | ([AsyncSource[number]] extends [never] ? never : undefined),
          ]
    >
  ): Route<
    {},
    Params,
    OptionalParams,
    [AsyncSource[number]] extends [never] ? false : true
  >;
  to<Routes extends Record<string, () => RouteBase<boolean>>>(
    options: {
      routes: Routes;
      Component?: undefined;
      Container?: ComponentType<PropsWithChildren>;
    } & ToOptions<
      [keyof Params] extends [never]
        ? []
        : [
            params:
              | Params
              | ([AsyncSource[number]] extends [never] ? never : undefined),
          ]
    >
  ): Route<
    UnionToIntersection<Routes>,
    Params,
    OptionalParams,
    [AsyncSource[number]] extends [never] ? false : true
  >;
}

type PathAfterArray<
  Params = {},
  OptionalParams extends string = never,
  QueryParams extends string = never,
  AsyncSource extends [any?] | [] = [],
> = PathBase<Params, OptionalParams, AsyncSource> &
  PathAfterQuery<Params, OptionalParams, QueryParams, AsyncSource> & {
    segment<T extends string>(
      text: T extends `${string}/${string}` ? never : T
    ): PathCreator<Params, OptionalParams, QueryParams, AsyncSource>;
    oneOf<N extends string, const T extends string[]>(
      name: N extends keyof Params ? never : N,
      variants: T,
      optional?: false
    ): PathCreator<
      Params & {
        [key in N]: T[number];
      },
      QueryParams,
      OptionalParams,
      AsyncSource
    >;
  };

type PathAfterQuery<
  Params = {},
  OptionalParams extends string = never,
  QueryParams extends string = never,
  AsyncSource extends [any?] | [] = [],
> = PathBase<Params, OptionalParams, AsyncSource> & {
  query<
    N extends string,
    O extends boolean = false,
    DefaultValue extends Value | (() => Value) = never,
    Value = string,
  >(
    name: N extends keyof Params ? never : N,
    options?: ParamOptions<Value, DefaultValue, O, AsyncSource>
  ): PathAfterQuery<
    Params & {
      [key in N]:
        | Value
        | (O extends false
            ? never
            : [DefaultValue] extends [never]
              ? undefined
              : never);
    },
    OptionalParams | (O extends true ? N : never),
    QueryParams | N,
    AsyncSource
  > &
    PathAfterDeprecatedQuery<Params, OptionalParams, QueryParams, AsyncSource>;
};

type PathAfterDeprecatedQuery<
  Params = {},
  OptionalParams extends string = never,
  QueryParams extends string = never,
  AsyncSource extends [any?] | [] = [],
> = PathBase<Params, OptionalParams, AsyncSource> & {
  deprecatedQuery<const S extends string[]>(
    keys: S,
    mapper: (deprecatedValues: Partial<Record<S[number], string>>) => {
      [key in Extract<keyof Params, QueryParams>]?: Params[key];
    }
  ): PathBase<Params, OptionalParams, AsyncSource>;
};

type AsyncRoute = {
  async<T>(
    source: AsyncControl<T>
  ): PathCreator<{}, never, never, [source?: T]>;
};

type PathCreator<
  Params = {},
  OptionalParams extends string = never,
  QueryParams extends string = never,
  AsyncSource extends [any?] | [] = [],
> = PathAfterArray<Params, OptionalParams, QueryParams, AsyncSource> &
  PathAfterQuery<Params, OptionalParams, QueryParams, AsyncSource> & {
    param<
      N extends string,
      O extends boolean = false,
      DefaultValue extends Value = never,
      Value = string,
    >(
      name: N extends keyof Params ? never : N,
      options?: ParamOptions<Value, DefaultValue, O, AsyncSource>
    ): PathCreator<
      Params & {
        [key in N]:
          | Value
          | (O extends false
              ? never
              : [DefaultValue] extends [never]
                ? undefined
                : never);
      },
      OptionalParams | (O extends true ? N : never),
      QueryParams,
      AsyncSource
    >;
    array<N extends string, Value = string[]>(
      name: N extends keyof Params ? never : N,
      converter?: {
        stringify?(value: Value): string[];
        parse?(values: string[]): Value;
      }
    ): PathAfterArray<
      Params & {
        [key in N]: Value;
      },
      OptionalParams,
      QueryParams,
      AsyncSource
    >;
    oneOf<
      N extends string,
      const T extends string[],
      DefaultValue extends T[number] = never,
    >(
      name: N extends keyof Params ? never : N,
      variants: T,
      optional: true,
      defaultValue?: DefaultValue | (() => DefaultValue)
    ): PathCreator<
      Params & {
        [key in N]:
          | T[number]
          | ([DefaultValue] extends [never] ? undefined : never);
      },
      OptionalParams | N,
      QueryParams,
      AsyncSource
    >;
  };
