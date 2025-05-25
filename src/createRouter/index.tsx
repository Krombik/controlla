import { lazy, type Component, type ComponentType } from 'react';
import type { Converter } from '../types';
import createStateScope from '../createStateScope';
import noop from 'lodash.noop';
import createSimpleState from '../utils/createSimpleState';
import identity from 'lodash.identity';

type SimpleOptions = {
  query?: Record<string, SchemaItem<any>>;
  alternatives?: Record<string, Record<string, Converter<any>> | true>;
  params?: Record<string, Converter<any>>;
  startsWith?: boolean;
};

const parseArray = (value: string | undefined) =>
  value ? value.split('/') : [];

const stringifyArray = (value: string[]) => value.join('/');

function getParams(this: Router<any>) {
  const self = this;

  const route = self.currentRoute._value;

  return route && self._getRoute(route)!._scope;
}

function concat(
  this: Navigation,
  router: Router<any>,
  route: string,
  arg1?: string | Record<string, any>,
  arg2?: Record<string, any>
) {
  const self = this;

  self._items.push(
    typeof arg1 == 'string'
      ? { _route: router._getRoute(route)!, _params: arg2, _path: arg1 }
      : {
          _route: router._getRoute(route)!,
          _params: arg1,
          _path: undefined,
        }
  );

  return self;
}

function navigate(this: Navigation, replace?: boolean) {
  const { _router, _items } = this;

  let parent = _router._parent;

  let url = '';

  const search = new URLSearchParams();

  while (parent) {
    const { _path, _queryScheme, _queryParams } = parent._getRoute(
      parent.currentRoute._value
    )!;

    url = '/' + _path + url;

    if (_queryScheme) {
      for (const key in _queryScheme) {
        if (_queryParams!.has(key)) {
          search.set(key, _queryParams!.get(key)!);
        }
      }
    }

    parent = parent._parent;
  }

  for (let i = 0; i < _items.length; i++) {
    const item = _items[i];

    const {
      _route: { _paramsConverters, _queryScheme, _pathMap },
      _path,
    } = item;

    let _params = item._params;

    let orIndex = 0;

    if (_path) {
      url += _path;

      const p = _path.split('/');

      let orIndex = 0;

      for (let i = 0; i < p.length; i++) {
        const item = _pathMap[i];

        if (typeof item == 'object') {
          if (item.length == 1) {
            const key = item[0];

            _params = {
              ..._params,
              [key]:
                key in _paramsConverters
                  ? _paramsConverters[key].parse(p[i])
                  : p[i],
            };
          } else {
            _params = { ..._params, [orIndex++]: p[i] };
          }
        }
      }
    } else {
      for (let i = 0; i < _pathMap.length; i++) {
        const p = _pathMap[i];

        if (typeof p == 'string') {
          url += '/' + p;
        } else if (p.length == 1) {
          const key = p[0];

          const item = _params![key];

          url +=
            '/' +
            (key in _paramsConverters
              ? _paramsConverters[key].stringify(item)
              : item);
        } else {
          url += '/' + _params![orIndex++];
        }
      }
    }

    if (_queryScheme) {
      for (const key in _queryScheme) {
        const item = _queryScheme[key];

        const param = _params![key];

        if (param !== undefined) {
          search.set(key, item.converter.stringify(param));
        } else if (item.required) {
          throw new Error(`${key} is missed`);
        }
      }
    }
  }

  if (search.size) {
    url += '?' + search.toString();
  }

  history[replace ? 'replaceState' : 'pushState'](null, '', url);
}

function nav(
  this: Router<any>,
  route: string,
  arg1?: string | Record<string, any>,
  arg2?: Record<string, any>
): Navigation {
  const self = this;

  return {
    _items: [
      typeof arg1 == 'string'
        ? { _route: self._getRoute(route)!, _params: arg2, _path: arg1 }
        : {
            _route: self._getRoute(route)!,
            _params: arg1,
            _path: undefined,
          },
    ],
    _router: self,
    concat,
    navigate,
  };
}

type ParamOptions<Value, DefaultValue, O> = {
  stringify?(value: Value): string;
  parse?(value: string): Value;
  optional?: O;
  isValid?(value: Value): boolean;
  defaultValue?: DefaultValue;
};

declare const PATH_MARKER: unique symbol;

declare class PathBase<
  P = {},
  Q = {},
  OptionalPathParams extends keyof P = never,
  OptionalQueryParams extends keyof Q = never,
> {
  /** @internal */
  _complete(): {
    _getPath?(params: Record<string, any>): string;
    _addSearchParams(
      searchParams: URLSearchParams,
      params: Record<string, any>
    ): void;
    _extractPathParams(
      params: Record<string, any>,
      pathParams: Record<string, string | undefined>
    ): void;
    _extractQueryParams(
      params: Record<string, any>,
      searchParams: Pick<URLSearchParams, 'get'>
    ): void;
    readonly _regexStr: string;
    readonly _withPathParams: boolean;
    readonly _withQueryParams: boolean;
  };
  [PATH_MARKER]: [P, Q, OptionalPathParams, OptionalQueryParams];
}

type PathAfterArray<
  P = {},
  Q = {},
  OptionalPathParams extends keyof P = never,
  OptionalQueryParams extends keyof Q = never,
> = PathBase<P, Q, OptionalPathParams, OptionalQueryParams> &
  PathAfterQuery<P, Q, OptionalPathParams, OptionalQueryParams> & {
    literal(
      text: string,
      optional?: boolean
    ): PathCreator<P, Q, OptionalPathParams, OptionalQueryParams>;
    oneOf<N extends string, const T extends string[]>(
      name: N extends keyof P ? never : N extends keyof Q ? never : N,
      variants: T,
      optional?: false
    ): PathCreator<
      P & {
        [key in N]: T[number];
      },
      Q,
      OptionalPathParams,
      OptionalQueryParams
    >;
  };

type PathAfterQuery<
  P = {},
  Q = {},
  OptionalPathParams extends keyof P = never,
  OptionalQueryParams extends keyof Q = never,
> = PathBase<P, Q, OptionalPathParams, OptionalQueryParams> & {
  query<
    N extends string,
    O extends boolean = false,
    DefaultValue extends Value | (() => Value) = never,
    Value = string,
  >(
    name: N extends keyof P ? never : N extends keyof Q ? never : N,
    options?: ParamOptions<Value, DefaultValue, O>
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
    OptionalPathParams,
    OptionalQueryParams | (O extends true ? N : never)
  >;
};

type PathCreator<
  P = {},
  Q = {},
  OptionalPathParams extends keyof P = never,
  OptionalQueryParams extends keyof Q = never,
> = PathAfterArray<P, Q, OptionalPathParams, OptionalQueryParams> &
  PathAfterQuery<P, Q, OptionalPathParams, OptionalQueryParams> & {
    any(
      optional?: boolean
    ): PathCreator<P, Q, OptionalPathParams, OptionalQueryParams>;
    param<
      N extends string,
      O extends boolean = false,
      DefaultValue extends Value | (() => Value) = never,
      Value = string,
    >(
      name: N extends keyof P ? never : N extends keyof Q ? never : N,
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
      OptionalPathParams | (O extends true ? N : never),
      OptionalQueryParams
    >;
    array<N extends string, Value = string[]>(
      name: N extends keyof P ? never : N extends keyof Q ? never : N,
      converter?: {
        stringify?(value: Value): string[];
        parse?(values: string[]): Value;
      }
    ): PathAfterArray<
      P & {
        [key in N]: Value;
      },
      Q,
      OptionalPathParams,
      OptionalQueryParams
    >;
    oneOf<
      N extends string,
      const T extends string[],
      DefaultValue extends T[number] | (() => T[number]) = never,
    >(
      name: N extends keyof P ? never : N extends keyof Q ? never : N,
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
      OptionalPathParams | N,
      OptionalQueryParams
    >;
  };

const createPath = (): PathCreator => {
  let regexStr = '';

  let withAny = false;

  const path: string[] = [];

  const pathParams: string[] = [];

  const queryParams: string[] = [];

  const parsers = new Map<string, (value: string | undefined) => any>();

  const stringifies = new Map<string, (value: any) => string | undefined>();

  return {
    _complete() {
      let getPath: ((params: Record<string, any>) => string) | undefined;

      const l = path.length;

      const getStringify = stringifies.get.bind(stringifies) as (
        key: string
      ) => (value: any) => string | undefined;

      if (!withAny) {
        if (!l || (l == 1 && path[0][0] == '/')) {
          const str = l ? path[0] : '';

          getPath = () => str;
        } else {
          getPath = (params) => {
            let str = '';

            for (let i = 0; i < l; i++) {
              const item = path[i];

              if (item[0] == '/') {
                str += item;
              } else {
                const value = getStringify(item)(params[item]);

                if (value !== undefined) {
                  str += '/' + value;
                }
              }
            }

            return str;
          };
        }
      }

      return {
        _getPath: getPath,
        _addSearchParams: withQueryParams
          ? (searchParams, params) => {
              for (const name in queryStringifies) {
                const value = queryStringifies[name](params[name]);

                if (value !== undefined) {
                  searchParams.set(name, value);
                }
              }
            }
          : noop,
        _extractPathParams(params, pathParams) {
          for (const key in pathParsers) {
            params[key] = pathParsers[key](pathParams[key]);
          }
        },
        _extractQueryParams(params, searchParams) {
          for (const key in queryParsers) {
            params[key] = queryParsers[key](searchParams.get(key) || undefined);
          }
        },
        _regexStr: regexStr,
        _withPathParams: withPathParams,
        _withQueryParams: withQueryParams,
      };
    },
    literal(text, optional) {
      text = '/' + text;

      const pattern = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      const l = path.length;

      if (l && path[l - 1][0] == '/') {
        path[l - 1] += text;
      } else {
        path.push(text);
      }

      regexStr += optional ? `(?:${pattern})?` : pattern;

      return this;
    },
    any(optional) {
      const pattern = '/([^/]+)';

      withAny = true;

      regexStr += optional ? `(?:${pattern})?` : pattern;

      return this;
    },
    param(name, options) {
      const pattern = `/(?<${name}>[^/]+)`;

      const stringify = options && options.stringify;

      const parse = options && options.parse;

      const optional = options && options.optional;

      regexStr += optional ? `(?:${pattern})?` : pattern;

      parsers.set(
        name,
        parse
          ? optional
            ? (value) => (value ? parse(value) : undefined)
            : parse
          : identity
      );

      stringifies.set(
        name,
        stringify
          ? optional
            ? (item) => (item !== undefined ? stringify(item) : item)
            : stringify
          : identity
      );

      path.push(name);

      pathParams.push(name);

      return this as any;
    },
    array(name, converter) {
      const stringify = converter && converter.stringify;

      const parse = converter && converter.parse;

      regexStr += `(?:/(?<${name}>(?:[^/]+(?:/[^/]+)*)))?`;

      parsers.set(
        name,
        parse ? (value) => (value ? parse(value.split('/')) : []) : parseArray
      );

      stringifies.set(
        name,
        stringify ? (value) => stringify(value).join('/') : stringifyArray
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

      stringifies.set(name, identity);

      path.push(name);

      pathParams.push(name);

      return this;
    },
    query(name, options) {
      const stringify = options && options.stringify;

      const parse = options && options.parse;

      const optional = options && options.optional;

      parsers.set(
        name,
        parse
          ? optional
            ? (value) => (value ? parse(value) : undefined)
            : parse
          : identity
      );

      stringifies.set(
        name,
        stringify
          ? optional
            ? (item) => (item !== undefined ? stringify(item) : item)
            : stringify
          : identity
      );

      queryParams.push(name);

      return this as any;
    },
  } as PathCreator<any, any>;
};

const c = createPath()
  .oneOf('kek', ['zalupa', 'konya'], true, 'konya')
  .param('oppa', {
    // parse:()=>123,

    optional: true,
    // defaultValue:()=> '123'
  });

const createRouter = (): RouterCreator => {
  const map = new Map<string, Route>();

  const currentPath = location.pathname.split('/');

  const currentRoute = createSimpleState() as State<string | undefined>;

  const router = {
    currentRoute,
    _getRoute: map.get.bind(map),
    _parent: null,
    _isMounted: false,
    getParams,
    nav,
  } as Router<any>;

  function addToMap<T>(
    this: T,
    route: string,
    Component: ComponentType,
    options: SimpleOptions
  ) {
    const querySchema = options && options.query;

    const path: Route['_pathMap'] = [];

    const p = route.split('/');

    for (let i = 1; i < p.length; i++) {
      const item = p[i];

      path.push(
        item[0] == ':'
          ? [item.slice(1)]
          : item.includes('|')
            ? item.split('|')
            : item
      );
    }

    map.set(route, {
      _component: Component,
      _key: route,
      _queryScheme: querySchema,
      _paramsConverters: (options && options.params) || {},
      _scope:
        querySchema || route.includes(':') || route.includes('|')
          ? createStateScope()
          : undefined,
      _pathMap: path,
    });

    return this;
  }

  return {
    create: () => router,
    add(route, Component, options: SimpleOptions) {
      const self = this;

      const path = route.split('/');

      const l = path.length;

      if (l == currentPath.length) {
        let params: undefined | object;

        let orIndex = 0;

        const querySchema = options && options.query;

        const paramsNames: string[] = [];

        const paramsConverters = (options && options.params) || {};

        for (let i = 1; i < l; i++) {
          const item = path[i];

          const currItem = currentPath[i];

          if (item != currItem || item != '_') {
            if (item[0] == ':') {
              const key = item.slice(1);

              let value;

              if (key in paramsConverters) {
                try {
                  value = paramsConverters[key].parse(currItem);
                } catch {
                  addToMap(key, Component, options);

                  return self;
                }
              } else {
                value = currItem;
              }

              params = { ...params, [key]: value };

              paramsNames.push(key);
            } else if (
              item.includes('|') &&
              item.split('|').includes(currItem)
            ) {
              paramsNames.push('' + orIndex);

              params = { ...params, [orIndex++]: currItem };
            } else {
              addToMap(route, Component, options);

              return self;
            }
          }
        }

        currentRoute._value = route;

        if (querySchema) {
          const search = new URLSearchParams(location.search);

          for (const param in querySchema) {
            const { converter, defaultValue, required } = querySchema[param];

            const strValue = search.get(param);

            if (strValue != null) {
              let value;

              try {
                value = converter.parse(strValue);
              } catch {
                if (required) {
                  addToMap(route, Component, options);

                  return self;
                }

                value = defaultValue;
              }

              params = { ...params, [param]: value };
            } else if (!required) {
              params = { ...params, [param]: defaultValue };
            } else {
              addToMap(route, Component, options);

              return self;
            }
          }
        }

        const scope = createStateScope<any>(params);

        let isPathParamsChanged = false;

        const unlisteners = [
          scope.$tate._onValueChange((value) => {
            const search = new URLSearchParams(location.search);

            if (querySchema) {
              for (const key in value) {
                if (key in querySchema) {
                  search.set(
                    key,
                    querySchema[key].converter.stringify(value[key])
                  );
                }
              }
            }

            const str = search.toString();

            let href = location.pathname;

            if (isPathParamsChanged) {
            }

            let url = isPathParamsChanged
              ? route.replace(/:\w+/g, (match) => {
                  const key = match.slice(1);

                  return key in paramsConverters
                    ? paramsConverters[key].stringify(value[key])
                    : value[key];
                })
              : location.pathname;

            if (str) {
              href += '?' + str;
            }

            history.pushState(null, '', href);

            isPathParamsChanged = false;
          }),
        ];

        const fn = () => {
          isPathParamsChanged = true;
        };

        for (let i = 0; i < paramsNames.length; i++) {
          unlisteners.push(scope[paramsNames[i]].$tate._onValueChange(fn));
        }

        unlisteners.push(
          currentRoute._onValueChange(() => {
            for (let i = 0; i < unlisteners.length; i++) {
              unlisteners[i]();
            }
          })
        );

        map.set(route, {
          _component: Component,
          _key: route,
          _queryScheme: options && options.query,
          _paramsConverters: options && options.params,
          _scope: scope,
        });

        self.add = addToMap;

        return self;
      }

      addToMap(route, Component, options);

      return self;
    },
  };
};

export default createRouter;
