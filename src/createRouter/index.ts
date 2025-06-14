import {
  useSyncExternalStore,
  type FC,
  type PropsWithChildren,
  type ComponentType,
  type MouseEvent as ReactMouseEvent,
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
import { ROOT, ROUTE_METHODS, ROUTE_PARAMS } from '../utils/constants';
import { jsx } from 'react/jsx-runtime';
import concat from '../utils/concat';
import alwaysNoop from '../utils/alwaysNoop';
import alwaysTrue from '../utils/alwaysTrue';
import { postBatchCallbacksPush, scheduleBatch } from '../utils/batching';
import createScope from '../utils/createScope';
import getAsyncControl from '../utils/getAsyncControl';
import { set } from '../utils/control/scope';
import load from '../load';

const parseArray = (value: string) => value.split('/');

const stringifyArray = (value: string[], key: string) => {
  if (!value.length) {
    throw new Error(`${key} is empty`);
  }

  return value.join('/');
};

const getHref = (routes: RouteData[], updatedParams?: RouteParams[]) => {
  let path = '';

  let search = '';

  let routeIndex = 0;

  const handleRoute = (route: RouteData) => {
    if (route._params && !route._isMatched._value) {
      throw new Error('route not mounted');
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
      let stringifiedParams: Record<string, string>;

      let params: Record<string, any>;

      const data = updatedParams[i];

      const route = data._route;

      const _params = data._params;

      const max = route._selfIndex;

      for (; routeIndex < max; routeIndex++) {
        handleRoute(routes[routeIndex]);
      }

      if (_params) {
        params =
          typeof _params == 'object' ? _params : _params(route._params!._value);

        stringifiedParams = route._stringifyParams(params);
      } else {
        const _stringifiedParams = data._stringifiedParams!;

        const source = route._source && route._source._value;

        stringifiedParams =
          typeof _stringifiedParams == 'object'
            ? _stringifiedParams
            : _stringifiedParams(route._stringifiedParams!);

        params = {};

        route._extractPathParams(params, stringifiedParams, source);

        route._extractQueryParams(params, stringifiedParams, source);
      }

      path = route._getPathStringified(path, stringifiedParams);

      search = route._getSearchStringified(search, stringifiedParams);

      route._params!._set(params);

      routeIndex++;
    }
  }

  for (; routeIndex < routes.length; routeIndex++) {
    handleRoute(routes[routeIndex]);
  }

  return path + search;
};

// const useHref = (routes: RouteData[], updatedParams?: RouteParams[]) => {
//   let path = '';

//   let search = '';

//   let routeIndex = 0;

//   const handleRoute = (route: RouteData) => {
//     if (route._params && !route._isMatched._value) {
//       throw new Error('route not mounted');
//     }

//     const p = route._stringifiedParams;

//     path = route._getPathStringified(path, p!);

//     search = route._getSearchStringified(search, p!);
//   };

//   if (updatedParams) {
//     const updatedParamsLastRoute =
//       updatedParams[updatedParams.length - 1]._route;

//     const updatedParamsLastRouteIndex = updatedParamsLastRoute._selfIndex;

//     if (
//       updatedParamsLastRouteIndex != routes.length - 1 &&
//       updatedParamsLastRoute != routes[updatedParamsLastRouteIndex]
//     ) {
//       throw new Error('route not mounted');
//     }

//     for (let i = 0; i < updatedParams.length; i++) {
//       const data = updatedParams[i];

//       const route = data._route;

//       const params = data._params;

//       const max = route._selfIndex;

//       for (; routeIndex < max; routeIndex++) {
//         handleRoute(routes[routeIndex]);
//       }

//       if (params) {
//         const p =
//           typeof params == 'object' ? params : params(route._params!._value);

//         path = route._getPath(path, p);

//         search = route._getSearch(search, p);
//       } else {
//         const stringifiedParams = data._stringifiedParams!;

//         const p =
//           typeof stringifiedParams == 'object'
//             ? stringifiedParams
//             : stringifiedParams(route._stringifiedParams!);

//         path = route._getPathStringified(path, p);

//         search = route._getSearchStringified(search, p);
//       }

//       routeIndex++;
//     }
//   }

//   for (; routeIndex < routes.length; routeIndex++) {
//     handleRoute(routes[routeIndex]);
//   }

//   return path + search;
// };

const handleHref = (
  routes: RouteData[],
  params?: RouteParams[],
  maxControls?: number
) => {
  let path = '';

  let search = '';

  let routeIndex = 0;

  const handleRoute = (route: RouteData) => {
    const params = route._params;

    let p;

    if (params) {
      if (!route._isMatched._value) {
        throw new Error('route not mounted');
      }

      p = params._value;

      if (maxControls) {
        if ('_subscribeWithError' in params) {
          const errorControl = params[ROOT]._errorControl[ROOT];

          if (errorControl._value !== undefined) {
            throw errorControl._value;
          }

          useSyncExternalStore(
            params._subscribeWithError,
            () => (errorControl._valueToggler << 1) | params._valueToggler
          );
        } else {
          useSyncExternalStore(params._subscribe, () => params._valueToggler);
        }

        maxControls--;
      }
    }

    path = route._getPath(path, p!);

    search = route._getSearch(search, p!);
  };

  if (params) {
    const lastRoute = params[params.length - 1]._route;

    if (lastRoute != routes[lastRoute._selfIndex]) {
      throw new Error('route not mounted');
    }

    for (let i = 0; i < params.length; i++) {
      const d = params[i];

      const route = d._route;

      // const p = d._params;

      const max = route._selfIndex;

      for (; routeIndex < max; routeIndex++) {
        handleRoute(routes[routeIndex]);
      }

      // path = route._getPath(path, p);

      // search = route._getSearch(search, p);

      if (maxControls && route._params) {
        useSyncExternalStore(alwaysNoop, noop);

        maxControls--;
      }

      routeIndex++;
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

  return path + search;
};

const nonUndefinedIdentity = (value: any, key: string) => {
  if (value === undefined) {
    throw new Error(`${key} is required`);
  }

  return value;
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
        ? (value) =>
            value !== undefined ? stringify(value) : getDefaultValue()
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
  options: ToOptions & {
    NotFound: ComponentType;
    getRoutes(createRoute: () => PathCreator): Routes;
  }
): { readonly Router: FC; readonly router: Routes } => {
  let nestingIndex = 0;

  let maxParamsPerRoute = 0;

  let currentRouteIndex = -1;

  let paramsWasReplaced = false;

  const { NotFound } = options;

  const pathQueue: string[] = [];

  const routesQueue: RouteData[][] = [];

  const componentsQueue: ComponentType[][] = [];

  const nestingLevels = new Map<number, number[]>();

  const routerComponentsList: ComponentType[][] = [];

  const handleMatching = (nextRoute: RouteData[]) => {
    if (currentRouteIndex > 0) {
      const currentRoute = routesQueue[currentRouteIndex];

      if (currentRoute != nextRoute) {
        const nextL = nextRoute.length - 1;

        let start = currentRoute.length - 1;

        if (start != nextL) {
          let end, target, value;

          if (start > nextL) {
            end = nextL;

            target = currentRoute;

            value = false;
          } else {
            end = start;

            start = nextL;

            target = nextRoute;

            value = true;
          }

          for (; start > end; start--) {
            target[start]._isMatched._set(value);
          }
        }

        for (; start >= 0; start--) {
          const curr = currentRoute[start];

          const next = nextRoute[start];

          if (curr == next) {
            return;
          }

          curr._isMatched._set(false);

          next._isMatched._set(true);
        }
      }
    } else {
      for (let i = nextRoute.length; i--; ) {
        nextRoute[i]._isMatched._set(true);
      }
    }
  };

  const navigate = (
    routes: RouteData[],
    componentList: ComponentType[],
    event: ReactMouseEvent<HTMLAnchorElement, any> | null,
    params: RouteParams[] | undefined,
    replace: boolean | undefined,
    onClick:
      | ((event: ReactMouseEvent<HTMLAnchorElement, any>) => void)
      | undefined
  ) => {
    let href: string;

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

      href = el.href;
    } else {
      href = handleHref(routes, params);
    }

    handleMatching(routes);

    if (params) {
      for (let i = 0; i < params.length; i++) {
        const d = params[i];

        d._route._params!._set(d._params);
      }
    }

    for (let i = 0; i < componentList.length; i++) {
      setControlArr[i](componentList[i]);
    }

    history[replace ? 'replaceState' : 'pushState'](null, '', href);
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
        options: ToOptions &
          (
            | {
                Wrapper?: ComponentType<PropsWithChildren>;
                routes: Record<string, () => RouteBase<boolean>>;
              }
            | { Component: ComponentType }
          )
      ) {
        let getPath: (
          prevSearch: string,
          params: Record<string, any>
        ) => string;

        let getPathStringified: (
          prevSearch: string,
          stringifiedParams: Record<string, string>
        ) => string;

        const l = path.length;

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

        const routeData: RouteData = {
          _pathParamsCount: pathParamsCount,
          _currentPath: pathParamsCount || !l ? '' : path[0],
          _currentSearch: '',
          _selfIndex: currentNestingIndex,
          _getPath: pathParamsCount
            ? (params) => {
                let str = '';

                for (let i = 0; i < l; i++) {
                  const item = path[i];

                  if (item[0] == '/') {
                    str += item;
                  } else {
                    const param = params[item];

                    const value = getStringify(item)!(
                      param !== '' ? param : undefined,
                      item
                    );

                    if (value !== undefined) {
                      str += '/' + value;
                    }
                  }
                }

                return str;
              }
            : (noop as never),
          _getPathStringified: pathParamsCount
            ? (stringifiedParams) => {
                let str = '';

                for (let i = 0; i < l; i++) {
                  const item = path[i];

                  if (item[0] == '/') {
                    str += item;
                  } else {
                    const value = stringifiedParams[item];

                    if (value) {
                      str += '/' + value;
                    }
                  }
                }

                return str;
              }
            : (noop as never),
          _getSearchStringified: queryParamsCount
            ? (stringifiedParams) => {
                let search = '';

                for (let i = 0; i < queryParamsCount; i++) {
                  const name = queryParams[i];

                  const value = stringifiedParams[name];

                  if (value) {
                    if (search) {
                      search += `&${name}=${encodeURIComponent(value)}`;
                    } else {
                      search = `${name}=${encodeURIComponent(value)}`;
                    }
                  }
                }

                return search;
              }
            : (noop as never),
          _getSearch: queryParamsCount
            ? (params) => {
                let search = '';

                for (let i = 0; i < queryParamsCount; i++) {
                  const name = queryParams[i];

                  const param = params[name];

                  const value = getStringify(name)!(
                    param !== '' ? param : undefined,
                    name
                  );

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
            : (noop as never),
          _extractPathParams: pathParamsCount
            ? (target, params, source) => {
                for (let i = 0; i < pathParamsCount; i++) {
                  const key = pathParams[i];

                  target[key] = getParse(key)!(params[key], source, key);
                }
              }
            : noop,
          _extractQueryParams: queryParamsCount
            ? (target, params, source) => {
                for (let i = 0; i < queryParamsCount; i++) {
                  const key = queryParams[i];

                  target[key] = getParse(key)!(params[key], source, key);
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
          _params: paramsControl && paramsControl[ROOT],
          _source: asyncSourceControl,
        };

        let route: (
          this: RouteBase<boolean>,
          params?: null | ProcessParams<Record<string, any>>,
          stringifiedPrams?: ProcessParams<Record<string, string>>
        ) => RouteBase<boolean>;

        if ('Component' in options) {
          const routes = new Array<RouteData>(nestingIndex);

          const componentList: ComponentType[] = [];

          const methods: RouteMethods = {
            _navigate(event, params, replace, onClick) {
              navigate(routes, componentList, event, params, replace, onClick);
            },
            _useHref: (params) => handleHref(routes, params, maxParamsPerRoute),
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
          const { Wrapper, routes } = options;

          const methods: RouteMethods = {
            _navigate(event, params, replace, onClick) {
              navigate(
                routesQueue[currentRouteIndex],
                routerComponentsList[currentRouteIndex],
                event,
                params,
                replace,
                onClick
              );
            },
            _useHref: (params) =>
              handleHref(
                routesQueue[currentRouteIndex],
                params,
                maxParamsPerRoute
              ),
          };

          for (let i = currentPathQueueIndex; i < pathQueue.length; i++) {
            pathQueue[i] = regexStr + pathQueue[i];

            routesQueue[i][currentNestingIndex] = routeData;

            if (Wrapper) {
              const components = componentsQueue[i];

              const l = components.length;

              if (nestingLevels.has(l)) {
                nestingLevels.get(l)!.push(i);
              } else {
                nestingLevels.set(l, [i]);
              }

              components.push(Wrapper);
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

        return route;
      },
      async(source) {
        asyncSourceControl = source[ROOT][ROOT];

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

        if (parse) {
          const safeParse: typeof parse = (value, source) => {
            let parsed;

            try {
              parsed = parse(value, source);
            } catch (error) {
              return getFallbackValue(value, source, error);
            }

            return isValid(parsed, source)
              ? parsed
              : getFallbackValue(value, source);
          };

          parsers.set(
            name,
            optional
              ? getDefaultValue
                ? (value, source) =>
                    value ? safeParse(value, source) : getDefaultValue(source)
                : (value, source) => value && safeParse(value, source)
              : safeParse
          );
        } else if (isValid == alwaysTrue) {
          parsers.set(
            name,
            optional && getDefaultValue
              ? (value, source) => value || getDefaultValue(source)
              : identity
          );
        } else {
          parsers.set(
            name,
            optional && getDefaultValue
              ? (value, source) =>
                  value
                    ? isValid(value as any, source)
                      ? value
                      : getFallbackValue(value, source)
                    : getDefaultValue(source)
              : (value, source) =>
                  !value || isValid(value as any, source)
                    ? value
                    : getFallbackValue(value, source)
          );
        }

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

        if (parse) {
          const safeParse = (
            value: string | undefined,
            source: any,
            key: string
          ) => {
            let parsed;

            try {
              parsed = parse(nonUndefinedIdentity(value, key), source);
            } catch (error) {
              return getFallbackValue(value, source, error);
            }

            return isValid(parsed, source)
              ? parsed
              : getFallbackValue(value, source);
          };

          parsers.set(
            name,
            optional
              ? getDefaultValue
                ? (value, source, key) =>
                    value
                      ? safeParse(value, source, key)
                      : getDefaultValue(source)
                : (value, source, key) => value && safeParse(value, source, key)
              : safeParse
          );
        } else if (isValid == alwaysTrue) {
          parsers.set(
            name,
            optional
              ? getDefaultValue
                ? (value, source) => value || getDefaultValue(source)
                : identity
              : (value, source) => value || getFallbackValue(value, source)
          );
        } else {
          parsers.set(
            name,
            optional
              ? getDefaultValue
                ? (value, source) =>
                    value
                      ? isValid(value as any, source)
                        ? value
                        : getFallbackValue(value, source)
                      : getDefaultValue(source)
                : (value, source) =>
                    value
                      ? isValid(value as any, source)
                        ? value
                        : getFallbackValue(value, source)
                      : value
              : (value, source) =>
                  value && isValid(value as any, source)
                    ? value
                    : getFallbackValue(value, source)
          );
        }

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
    } as PathCreator<any, any> & Partial<PathAfterDeprecatedQuery<any, any>>;
  });

  const l = pathQueue.length;

  const findCurrentRouteArr = new Array<
    (path: string, search: string) => boolean
  >(l);

  const setControlArr: Array<(component: ComponentType) => void> = [];

  const EMPTY_PROPS = {};

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
      jsx(useSyncExternalStore(subscribe, getComponent), EMPTY_PROPS);
  };

  const { pathname, search } = location;

  const Router = handleRouter();

  for (let i = nestingLevels.size; i > 1; i--) {
    const map = new Map<ComponentType, FC>();

    const level = nestingLevels.get(i)!;

    const Router = handleRouter();

    for (let j = 0; j < level.length; j++) {
      const index = level[j];

      const Wrapper = componentsQueue[index][i];

      if (!map.has(Wrapper)) {
        map.set(Wrapper, () =>
          jsx(Wrapper, { children: jsx(Router, EMPTY_PROPS) })
        );
      }

      routerComponentsList[index].push(map.get(Wrapper)!);
    }
  }

  for (let i = 0; i < l; i++) {
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

    const findCurrentRoute = (path: string, search: string) => {
      const isMatched = testRegex(path);

      if (isMatched) {
        if (withParams) {
          const searchParams: Record<string, string> = {};

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

          for (let i = 0; i < routes.length; i++) {
            const route = routes[i];

            const paramsControl = route._params;

            if (paramsControl) {
              const source = route._source;

              if (!source || source[ROOT]._isLoadedControl[ROOT]._value) {
                const prevReplace = paramsWasReplaced;

                const value = source && source._get();

                const params = {};

                route._replaceDeprecatedQueryParams(searchParams);

                try {
                  route._extractPathParams(
                    params,
                    isMatched as RegExpExecArray,
                    value
                  );

                  route._extractQueryParams(params, searchParams, value);
                } catch (err) {
                  if (source) {
                    paramsWasReplaced = prevReplace;

                    (paramsControl as InternalAsyncControl)._errorControl[
                      ROOT
                    ]._set(err);

                    continue;
                  }

                  paramsWasReplaced = false;

                  return false;
                }

                paramsControl._set(params);
              } else {
                const unlisten = source[ROOT]._subscribeWithError(() => {
                  unlisten();

                  const value = source._get();

                  const params = {};

                  route._replaceDeprecatedQueryParams(searchParams);

                  try {
                    route._extractPathParams(
                      params,
                      isMatched as RegExpExecArray,
                      value
                    );

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

                    history.replaceState(null, '', handleHref(routes));
                  }

                  paramsControl._set(params);
                });
              }
            }
          }

          if (paramsWasReplaced) {
            paramsWasReplaced = false;

            history.replaceState(null, '', handleHref(routes));
          }
        }

        handleMatching(routes);

        currentRouteIndex = i;

        for (let i = 0; i < components.length; i++) {
          setControlArr[i](components[i]);
        }
      }

      return !!isMatched;
    };

    findCurrentRouteArr[i] = findCurrentRoute;

    if (currentRouteIndex < 0) {
      findCurrentRoute(pathname, search);
    }
  }

  if (currentRouteIndex < 0) {
    setControlArr[0](NotFound);
  }

  window.addEventListener('popstate', () => {
    const { pathname, search } = location;

    for (let i = 0; i < l; i++) {
      if (findCurrentRouteArr[i](pathname, search)) {
        return;
      }
    }

    if (currentRouteIndex > -1) {
      const routes = routesQueue[currentRouteIndex];

      for (let i = routes.length; i--; ) {
        routes[i]._isMatched._set(false);
      }

      currentRouteIndex = -1;

      setControlArr[0](NotFound);
    }
  });

  return {
    router,
    Router,
  };
};

export default createRouter;

declare const ROUTE_MARKER: unique symbol;

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
  _getPath(params: Record<string, any>): string;
  _getSearch(params: Record<string, any>): string;
  _getPathStringified(stringifiedParams: Record<string, string>): string;
  _getSearchStringified(stringifiedParams: Record<string, string>): string;
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
  readonly _selfIndex: number;
  readonly _params: InternalControl | InternalAsyncControl | null;
  readonly _source: InternalAsyncControl | undefined;
  readonly _isMatched: InternalControl;
  readonly _pathParamsCount: number;
  _currentPath: string;
  _currentSearch: string;
};

type RouteParams = {
  readonly _route: RouteData;
  readonly _params: ProcessParams<Record<string, any>> | null | undefined;
  readonly _stringifiedParams:
    | ProcessParams<Record<string, string>>
    | null
    | undefined;
};

type RouteMethods = {
  _useHref(params: RouteParams[] | undefined): string;
  _navigate(
    event: ReactMouseEvent<HTMLAnchorElement, any> | null,
    params?: RouteParams[],
    replace?: boolean,
    onClick?: (event: ReactMouseEvent<HTMLAnchorElement, any>) => void
  ): void;
};

export type RouteBase<Navigable extends boolean> = {
  /** @internal */
  readonly [ROUTE_METHODS]: RouteMethods;
  /** @internal */
  readonly [ROUTE_PARAMS]?: RouteParams[];
  [ROUTE_MARKER]: Navigable;
};

type ProcessParams<O> = O | ((prev: O) => O);

type Route<
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
    }) &
  ([keyof Params] extends [never]
    ? {}
    : {
        (
          params: ProcessParams<
            {
              [key in Exclude<keyof Params, OptionalParams>]: Params[key];
            } & {
              [key in Extract<keyof Params, OptionalParams>]?: Params[key];
            }
          >
        ): Children & RouteBase<true>;
        (
          params: null,
          stringifiedParams: {
            [key in Exclude<
              keyof Params,
              OptionalParams
            >]: Params[key] extends string ? Params[key] : string;
          } & {
            [key in Extract<keyof Params, OptionalParams>]?: NonNullable<
              Params[key]
            > extends string
              ? Params[key]
              : string;
          }
        ): Children & RouteBase<true>;
      });

type ToOptions = {
  load?(): (() => void) | Array<() => void> | void;
};

declare class PathBase<
  Params = {},
  OptionalParams extends string = never,
  AsyncSource extends [any?] | [] = [],
> {
  to(
    options: { Component: ComponentType; routes?: undefined } & ToOptions
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
      Wrapper?: ComponentType<PropsWithChildren>;
    } & ToOptions
  ): Route<
    Routes,
    Params,
    OptionalParams,
    [AsyncSource[number]] extends [never] ? false : true
  >;
}

type PathAfterArray<
  Params = {},
  OptionalParams extends string = never,
  AsyncSource extends [any?] | [] = [],
> = PathBase<Params, OptionalParams, AsyncSource> &
  PathAfterQuery<Params, OptionalParams, AsyncSource> & {
    segment<T extends string>(
      text: T extends `${string}/${string}` ? never : T
    ): PathCreator<Params, OptionalParams, AsyncSource>;
    oneOf<N extends string, const T extends string[]>(
      name: N extends keyof Params ? never : N,
      variants: T,
      optional?: false
    ): PathCreator<
      Params & {
        [key in N]: T[number];
      },
      OptionalParams,
      AsyncSource
    >;
  };

type PathAfterQuery<
  Params = {},
  OptionalParams extends string = never,
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
    AsyncSource
  > &
    PathAfterDeprecatedQuery<Params, OptionalParams, AsyncSource>;
};

type PathAfterDeprecatedQuery<
  Params = {},
  OptionalParams extends string = never,
  AsyncSource extends [any?] | [] = [],
> = PathBase<Params, OptionalParams, AsyncSource> & {
  deprecatedQuery<const S extends string[]>(
    keys: S,
    mapper: (
      deprecatedValues: Partial<Record<S[number], string>>
    ) => Partial<Params>
  ): PathBase<Params, OptionalParams, AsyncSource>;
};

type AsyncRoute = {
  async<T>(source: AsyncControl<T>): PathCreator<{}, never, [source?: T]>;
};

type PathCreator<
  Params = {},
  OptionalParams extends string = never,
  AsyncSource extends [any?] | [] = [],
> = AsyncRoute &
  PathAfterArray<Params, OptionalParams, AsyncSource> &
  PathAfterQuery<Params, OptionalParams, AsyncSource> & {
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
      AsyncSource
    >;
  };
