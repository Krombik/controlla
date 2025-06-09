import {
  FC,
  useSyncExternalStore,
  type PropsWithChildren,
  type ComponentType,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import type {
  InternalState,
  Mutable,
  ReadonlyState,
  ReadonlyStateScope,
} from '../types';
import createStateScope from '../createStateScope';
import noop from 'lodash.noop';
import createSimpleState from '../utils/createSimpleState';
import identity from 'lodash.identity';
import alwaysFalse from '../utils/alwaysFalse';
import { ROOT } from '../utils/constants';
import { jsx } from 'react/jsx-runtime';
import concat from '../utils/concat';
import alwaysNoop from '../utils/alwaysNoop';

const parseArray = (value: string) => value.split('/');

const stringifyArray = (value: string[], key: string) => {
  if (!value.length) {
    throw new Error(`${key} is empty`);
  }

  return value.join('/');
};

const handleHref = (
  routes: RouteData[],
  params: RouteParams[] | undefined,
  maxStates?: number
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

      if (maxStates) {
        useSyncExternalStore(params._onValueChange, () => params._valueToggler);

        maxStates--;
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

      const p = d._params;

      const max = route._selfIndex;

      for (; routeIndex < max; routeIndex++) {
        handleRoute(routes[routeIndex]);
      }

      path = route._getPath(path, p);

      search = route._getSearch(search, p);

      if (maxStates && route._params) {
        useSyncExternalStore(alwaysNoop, noop);

        maxStates--;
      }

      routeIndex++;
    }
  }

  for (; routeIndex < routes.length; routeIndex++) {
    handleRoute(routes[routeIndex]);
  }

  if (maxStates) {
    while (maxStates--) {
      useSyncExternalStore(alwaysNoop, noop);
    }
  }

  return path + search;
};

const navigate = (
  routes: RouteData[],
  componentList: ComponentType[],
  setStateArr: Array<(Component: ComponentType) => void>,
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

  if (params) {
    for (let i = 0; i < params.length; i++) {
      const d = params[i];

      d._route._params!._set(d._params);
    }
  }

  for (let i = 0; i < componentList.length; i++) {
    setStateArr[i](componentList[i]);
  }

  history[replace ? 'replaceState' : 'pushState'](null, '', href);
};

const nonUndefinedIdentity = (value: any, key: string) => {
  if (value === undefined) {
    throw new Error(`${key} is required`);
  }

  return value;
};

const handleTransformer = (
  fn: ((value: any) => any) | undefined,
  optional: boolean | undefined
): typeof nonUndefinedIdentity =>
  fn
    ? optional
      ? (value) => (value !== undefined ? fn(value) : value)
      : (value, key) => fn(nonUndefinedIdentity(value, key))
    : optional
      ? identity
      : nonUndefinedIdentity;

const ROUTE_METHODS = Symbol();

const ROUTE_PARAMS = Symbol();

const createRouter: {
  <Routes extends Record<string, () => RouteBase<boolean>>>(
    options: ToOptions & { Wrapper?: ComponentType<PropsWithChildren> },
    getRoutes: (createRoute: () => PathCreator) => Routes
  ): { readonly Router: FC; readonly router: Routes };
  <Routes extends Record<string, () => RouteBase<boolean>>>(
    getRoutes: (createRoute: () => PathCreator) => Routes
  ): { readonly Router: FC; readonly router: Routes };
} = (
  arg1:
    | ((
        createRoute: () => PathCreator
      ) => Record<string, () => RouteBase<boolean>>)
    | (ToOptions & { Wrapper?: ComponentType<PropsWithChildren> }),
  arg2?: (
    createRoute: () => PathCreator
  ) => Record<string, () => RouteBase<boolean>>
) => {
  let nestingIndex = 0;

  let maxParamsPerRoute = 0;

  let currentRouteIndex = -1;

  const { Wrapper } = (arg2! ? arg1 : {}) as ToOptions & {
    Wrapper?: ComponentType<PropsWithChildren>;
  };

  const pathQueue: string[] = [];

  const routesQueue: RouteData[][] = [];

  const componentsQueue: ComponentType[][] = [];

  const nestingLevels = new Map<number, number[]>();

  const routerComponentsList: ComponentType[][] = [];

  const router = (
    (arg2 || arg1) as (
      createRoute: () => PathCreator
    ) => Record<string, () => RouteBase<boolean>>
  )(() => {
    let regexStr = '';

    let anyIndex = 0;

    const path: string[] = [];

    const pathParams: string[] = [];

    const queryParams: string[] = [];

    const parsers = new Map<
      string,
      (value: string | undefined, key: string) => any
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
        arg1:
          | ComponentType
          | Record<string, () => RouteBase<boolean>>
          | (ToOptions & { Wrapper?: ComponentType<PropsWithChildren> }),
        arg2?: ComponentType | Record<string, () => RouteBase<boolean>>
      ) {
        let getPath: (
          prevSearch: string,
          params: Record<string, any>
        ) => string;

        const routesOrComponent = (arg2 || arg1) as
          | ComponentType
          | Record<string, () => RouteBase<boolean>>;

        const options = (arg2 ? arg1 : {}) as ToOptions & {
          Wrapper?: ComponentType<PropsWithChildren>;
        };

        const l = path.length;

        const pathParamsCount = pathParams.length;

        const queryParamsCount = queryParams.length;

        const getStringify = stringifies.get.bind(stringifies) as (
          key: string
        ) => (value: any, key: string) => string | undefined;

        const getParse = parsers.get.bind(parsers) as (
          key: string
        ) => (value: string | undefined, key: string) => any;

        const isMatchedState = createSimpleState(false);

        const isMatchedRoot = isMatchedState[ROOT];

        const paramsState =
          pathParamsCount || queryParamsCount ? createStateScope() : null;

        if (!l) {
          getPath = identity;
        } else if (l == 1 && path[0][0] == '/') {
          const str = path[0];

          getPath = (path) => path + str;
        } else {
          getPath = (path, params) => {
            for (let i = 0; i < l; i++) {
              const item = path[i];

              if (item[0] == '/') {
                path += item;
              } else {
                const param = params[item];

                const value = getStringify(item)(
                  param !== '' ? param : undefined,
                  item
                );

                if (value !== undefined) {
                  path += '/' + value;
                }
              }
            }

            return path;
          };
        }

        const routeData: RouteData = {
          _selfIndex: currentNestingIndex,
          _getPath: getPath,
          _getSearch: queryParamsCount
            ? (search, params) => {
                for (let i = 0; i < queryParamsCount; i++) {
                  const name = queryParams[i];

                  const param = params[name];

                  const value = getStringify(name)(
                    param !== '' ? param : undefined,
                    name
                  );

                  if (value !== undefined) {
                    if (search) {
                      search += `&${name}=${encodeURIComponent(value)}`;
                    } else {
                      search = `?${name}=${encodeURIComponent(value)}`;
                    }
                  }
                }

                return search;
              }
            : identity,
          _extractPathParams: pathParamsCount
            ? (parent, execArray) => {
                const params = execArray.groups!;

                for (let i = 0; i < pathParamsCount; i++) {
                  const key = pathParams[i];

                  parent[key] = getParse(key)(params[key], key);
                }
              }
            : noop,
          _extractQueryParams: queryParamsCount
            ? (parent, params) => {
                for (let i = 0; i < queryParamsCount; i++) {
                  const key = queryParams[i];

                  parent[key] = getParse(key)(params.get(key), key);
                }
              }
            : noop,
          _replaceDeprecatedQueryParams: deprecatedKeys
            ? (searchParams) => {
                let replaced = false;

                const obj: Record<string, string> = {};

                for (let i = 0; i < deprecatedKeys!.length; i++) {
                  const key = deprecatedKeys![i];

                  if (searchParams.has(key)) {
                    const value = searchParams.get(key);

                    if (value) {
                      replaced = true;

                      obj[key] = value;
                    }

                    searchParams.delete(key);
                  }
                }

                if (replaced) {
                  try {
                    const params = deprecatedMapper!(obj);

                    for (const key in params) {
                      const param = params[key];

                      try {
                        const value = getStringify(key)(param, key);

                        if (value !== undefined && value !== '') {
                          searchParams.set(key, value);
                        }
                      } catch {}
                    }
                  } catch {}
                }

                return replaced;
              }
            : alwaysFalse,
          _isMatched: isMatchedRoot,
          _params: paramsState && paramsState[ROOT],
        };

        let route: Route<any, any, any>;

        if (typeof routesOrComponent == 'function') {
          const routes = new Array<RouteData>(nestingIndex);

          const componentList: ComponentType[] = [];

          const methods: RouteMethods = {
            _navigate(event, params, replace, onClick) {
              navigate(
                routes,
                componentList,
                setStateArr,
                event,
                params,
                replace,
                onClick
              );
            },
            _useHref: (params) => handleHref(routes, params, maxParamsPerRoute),
          };

          const res = {
            [ROUTE_METHODS]: methods,
          } as RouteBase<boolean>;

          routes[currentNestingIndex] = routeData;

          pathQueue.push(regexStr);

          routesQueue.push(routes);

          componentsQueue.push([routesOrComponent]);

          routerComponentsList.push(componentList);

          route = (
            paramsState
              ? function (this: RouteBase<boolean>, params) {
                  return arguments.length
                    ? {
                        [ROUTE_METHODS]: methods,
                        [ROUTE_PARAMS]:
                          ROUTE_PARAMS in this
                            ? concat(this[ROUTE_PARAMS]!, params)
                            : [params],
                      }
                    : ROUTE_PARAMS in this
                      ? {
                          [ROUTE_METHODS]: methods,
                          [ROUTE_PARAMS]: this[ROUTE_PARAMS],
                        }
                      : res;
                }
              : function (this: RouteBase<boolean>) {
                  return ROUTE_PARAMS in this
                    ? {
                        [ROUTE_METHODS]: methods,
                        [ROUTE_PARAMS]: this[ROUTE_PARAMS]!,
                      }
                    : res;
                }
          ) as Route<any, any>;
        } else {
          const { Wrapper } = options;

          const methods: RouteMethods = {
            _navigate(event, params, replace, onClick) {
              navigate(
                routesQueue[currentRouteIndex],
                routerComponentsList[currentRouteIndex],
                setStateArr,
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

          route = (
            paramsState
              ? function (this: RouteBase<boolean>, params) {
                  return arguments.length
                    ? {
                        ...routesOrComponent,
                        [ROUTE_METHODS]: methods,
                        [ROUTE_PARAMS]:
                          ROUTE_PARAMS in this
                            ? concat(this[ROUTE_PARAMS]!, params)
                            : [params],
                      }
                    : ROUTE_PARAMS in this
                      ? {
                          ...routesOrComponent,
                          [ROUTE_PARAMS]: this[ROUTE_PARAMS],
                        }
                      : routesOrComponent;
                }
              : function (this: RouteBase<boolean>) {
                  return ROUTE_PARAMS in this
                    ? {
                        ...routesOrComponent,
                        [ROUTE_PARAMS]: this[ROUTE_PARAMS]!,
                      }
                    : routesOrComponent;
                }
          ) as Route<any, any>;
        }

        if (paramsState) {
          Object.defineProperty(route, 'params', {
            get() {
              if (isMatchedRoot._value) {
                return paramsState;
              }

              throw new Error('route not mounted');
            },
          });
        }

        (route as Mutable<typeof route>).isMatched = isMatchedState;

        nestingIndex--;

        return route;
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
      any(optional) {
        const pattern = '/([^/]+)';

        const key = '' + anyIndex++;

        regexStr += optional ? `(?:${pattern})?` : pattern;

        path.push(key);

        stringifies.set(key, optional ? identity : nonUndefinedIdentity);

        return this;
      },
      param(name, options) {
        const pattern = `/(?<${name}>[^/]+)`;

        const parse = options && options.parse;

        const optional = options && options.optional;

        regexStr += optional ? `(?:${pattern})?` : pattern;

        parsers.set(
          name,
          parse
            ? optional
              ? (value) => (value !== undefined ? parse(value) : value)
              : parse
            : identity
        );

        stringifies.set(
          name,
          handleTransformer(options && options.stringify, optional)
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

        regexStr += optional ? `(?:${pattern})?` : pattern;

        parsers.set(name, identity);

        stringifies.set(name, optional ? identity : nonUndefinedIdentity);

        path.push(name);

        pathParams.push(name);

        return this;
      },
      query(name, options) {
        const optional = options && options.optional;

        parsers.set(
          name,
          handleTransformer(options && options.parse, optional)
        );

        stringifies.set(
          name,
          handleTransformer(options && options.stringify, optional)
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

  const setStateArr: Array<(component: ComponentType) => void> = [];

  const EMPTY_PROPS = {};

  const handleRouter = () => {
    let onValueChange: () => void = noop;

    let CurrentComponent: ComponentType = noop as any;

    const subscribe = (_onValueChange: () => void) => {
      onValueChange = _onValueChange;

      return () => {
        onValueChange = noop;
      };
    };

    const getComponent = () => CurrentComponent;

    setStateArr.push((component) => {
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
    const regex = new RegExp(`^${pathQueue[i]}$`);

    const routes = routesQueue[i];

    const components = routerComponentsList[i];

    let paramsCount = 0;

    components.push(componentsQueue[i][0]);

    for (let i = 0; i < routes.length; i++) {
      if (routes[i]._params) {
        paramsCount++;
      }
    }

    if (paramsCount > maxParamsPerRoute) {
      maxParamsPerRoute = paramsCount;
    }

    const withParams = !!paramsCount;

    const testRegex = regex[withParams ? 'exec' : 'test'].bind(regex);

    const findCurrentRoute = (path: string, search: string) => {
      const isMatched = testRegex(path);

      if (isMatched) {
        currentRouteIndex = i;

        if (withParams) {
          const searchParams = new Map<string, string>();

          const arr = search.split('&');

          for (let i = 0; i < arr.length; i++) {
            const t = arr[i].split('=');

            searchParams.set(t[0], t[1]);
          }

          for (let i = 0; i < routes.length; i++) {
            const route = routes[i];

            const paramsState = route._params;

            if (paramsState) {
              const params = {};

              route._extractPathParams(params, isMatched as RegExpExecArray);

              route._extractQueryParams(params, searchParams);

              paramsState._set(params);
            }
          }
        }

        for (let i = 0; i < components.length; i++) {
          setStateArr[i](components[i]);
        }
      }

      return !!isMatched;
    };

    findCurrentRouteArr[i] = findCurrentRoute;

    if (currentRouteIndex < 0) {
      findCurrentRoute(pathname, search);
    }
  }

  window.addEventListener('popstate', () => {
    const { pathname, search } = location;

    for (let i = 0; i < l; i++) {
      if (findCurrentRouteArr[i](pathname, search)) {
        return;
      }
    }
  });

  return {
    router,
    Router: Wrapper
      ? () => jsx(Wrapper, { children: jsx(Router, EMPTY_PROPS) })
      : Router,
  };
};

export default createRouter;

declare const ROUTE_MARKER: unique symbol;

type ParamOptions<Value, DefaultValue, O> = {
  stringify?(value: Value): string;
  parse?(value: string): Value;
  optional?: O;
  isValid?(value: Value): boolean;
  defaultValue?: DefaultValue;
  fallbackValue?: Value;
};

type RouteData = {
  _getPath(prevPath: string, params: Record<string, any>): string;
  _getSearch(prevSearch: string, params: Record<string, any>): string;
  _extractPathParams(
    params: Record<string, any>,
    pathParams: RegExpExecArray
  ): void;
  _extractQueryParams(
    params: Record<string, any>,
    searchParams: Map<string, string>
  ): void;
  _replaceDeprecatedQueryParams(searchParams: Map<string, string>): boolean;
  readonly _selfIndex: number;
  readonly _params: InternalState | null;
  readonly _isMatched: InternalState;
};

type RouteParams = {
  readonly _route: RouteData;
  readonly _params: any;
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

type RouteBase<Navigable extends boolean> = {
  /** @internal */
  readonly [ROUTE_METHODS]: RouteMethods;
  /** @internal */
  readonly [ROUTE_PARAMS]?: RouteParams[];
  [ROUTE_MARKER]: Navigable;
};

type Route<
  Children extends Record<string, () => RouteBase<boolean>> = {},
  P = {},
  Q = {},
  OptionalParams extends keyof P | keyof Q = never,
> = {
  (): {} extends Children ? RouteBase<true> : Children & RouteBase<false>;
  readonly isMatched: ReadonlyState<boolean>;
} & ([keyof P | keyof Q] extends [never]
  ? {}
  : {
      readonly params: ReadonlyStateScope<P & Q>;
      (
        params: {
          [key in keyof Q]:
            | Q[key]
            | (key extends OptionalParams ? undefined : never);
        } & {
          [key in keyof P]:
            | P[key]
            | (key extends OptionalParams ? undefined : never);
        }
      ): Children & RouteBase<true>;
      (
        url: string,
        ...args: [keyof Q] extends [never]
          ? []
          : [
              params: {
                [key in keyof Q]:
                  | Q[key]
                  | (key extends OptionalParams ? undefined : never);
              },
            ]
      ): Children & RouteBase<true>;
    });

type ToOptions = {
  preload?(): Array<() => void>;
  title?: any;
};

declare class PathBase<
  P = {},
  Q = {},
  OptionalParams extends keyof P | keyof Q = never,
> {
  to(Component: ComponentType): Route<{}, P, Q, OptionalParams>;
  to(
    options: ToOptions,
    Component: ComponentType
  ): Route<{}, P, Q, OptionalParams>;
  to<Routes extends Record<string, () => RouteBase<boolean>>>(
    routes: Routes
  ): Route<Routes, P, Q, OptionalParams>;
  to<Routes extends Record<string, () => RouteBase<boolean>>>(
    options: ToOptions & { Wrapper?: ComponentType<PropsWithChildren> },
    routes: Routes
  ): Route<Routes, P, Q, OptionalParams>;
}

type PathAfterArray<
  P = {},
  Q = {},
  OptionalParams extends keyof P | keyof Q = never,
> = PathBase<P, Q, OptionalParams> &
  PathAfterQuery<P, Q, OptionalParams> & {
    segment<T extends string>(
      text: T extends `${string}/${string}` ? never : T
    ): PathCreator<P, Q, OptionalParams>;
    oneOf<N extends string, const T extends string[]>(
      name: N extends keyof P | keyof Q ? never : N,
      variants: T,
      optional?: false
    ): PathCreator<
      P & {
        [key in N]: T[number];
      },
      Q,
      OptionalParams
    >;
  };

type PathAfterQuery<
  P = {},
  Q = {},
  OptionalParams extends keyof P | keyof Q = never,
> = PathBase<P, Q, OptionalParams> & {
  query<
    N extends string,
    O extends boolean = false,
    DefaultValue extends Value | (() => Value) = never,
    Value = string,
  >(
    name: N extends keyof P | keyof Q ? never : N,
    options?: ParamOptions<Value, DefaultValue, O> & { queryName?: string }
  ): PathAfterQuery<
    P,
    Q & {
      [key in N]:
        | Value
        | (O extends false
            ? never
            : [DefaultValue] extends [never]
              ? undefined
              : never);
    },
    OptionalParams | (O extends true ? N : never)
  > &
    PathAfterDeprecatedQuery<P, Q, OptionalParams>;
};

type PathAfterDeprecatedQuery<
  P = {},
  Q = {},
  OptionalParams extends keyof P | keyof Q = never,
> = PathBase<P, Q, OptionalParams> & {
  deprecatedQuery<const S extends string[]>(
    keys: S,
    mapper: (deprecatedValues: Partial<Record<S[number], string>>) => Partial<Q>
  ): PathBase<P, Q, OptionalParams>;
};

type PathCreator<
  P = {},
  Q = {},
  OptionalParams extends keyof P | keyof Q = never,
> = PathAfterArray<P, Q, OptionalParams> &
  PathAfterQuery<P, Q, OptionalParams> & {
    any(optional?: boolean): PathCreator<P, Q, OptionalParams>;
    param<
      N extends string,
      O extends boolean = false,
      DefaultValue extends Value | (() => Value) = never,
      Value = string,
    >(
      name: N extends keyof P | keyof Q ? never : N,
      options?: ParamOptions<Value, DefaultValue, O>
    ): PathCreator<
      P & {
        [key in N]:
          | Value
          | (O extends false
              ? never
              : [DefaultValue] extends [never]
                ? undefined
                : never);
      },
      Q,
      OptionalParams | (O extends true ? N : never)
    >;
    array<N extends string, Value = string[]>(
      name: N extends keyof P | keyof Q ? never : N,
      converter?: {
        stringify?(value: Value): string[];
        parse?(values: string[]): Value;
      }
    ): PathAfterArray<
      P & {
        [key in N]: Value;
      },
      Q,
      OptionalParams
    >;
    oneOf<
      N extends string,
      const T extends string[],
      DefaultValue extends T[number] | (() => T[number]) = never,
    >(
      name: N extends keyof P | keyof Q ? never : N,
      variants: T,
      optional: true,
      defaultValue?: DefaultValue
    ): PathCreator<
      P & {
        [key in N]:
          | T[number]
          | ([DefaultValue] extends [never] ? undefined : never);
      },
      Q,
      OptionalParams | N
    >;
  };
