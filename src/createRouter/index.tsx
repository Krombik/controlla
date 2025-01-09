import type { ComponentType } from 'react';
import type { Converter, State, StateScope, ToIndex } from '../types';
import createStateScope from '../createStateScope';
import noop from 'lodash.noop';
import createSimpleState from '../utils/createSimpleState';
// import createSimpleState from '../utils/createSimpleState';

type Kek = {
  readonly _key: string;
  readonly _component: ComponentType;
  readonly _scope: StateScope | undefined;
  readonly _queryScheme: Record<string, SchemaItem<any>> | undefined;
  readonly _paramsConverters: Record<string, Converter<any>> | undefined;
};

type ExtractParams<T extends string> =
  T extends `${any}:${infer Param}/${infer Rest}`
    ? Param | ExtractParams<Rest>
    : T extends `${any}:${infer Param}`
      ? Param
      : never;

type TakeAll<T extends string> = T extends `${infer K}|${infer Rest}`
  ? K | (Rest extends `${any}|${any}` ? TakeAll<Rest> : Rest)
  : never;

type ExtractEnums<
  T extends string,
  Arr extends string[] = [],
> = T extends `/${infer First}/${infer K}`
  ? First extends `${any}|${any}`
    ? [...Arr, TakeAll<First>, ...ExtractEnums<`/${K}`, Arr>]
    : [...Arr, ...ExtractEnums<`/${K}`, Arr>]
  : T extends `/${infer First}`
    ? First extends `${any}|${any}`
      ? [...Arr, TakeAll<First>]
      : Arr
    : [];

type NumerableRecord<A extends any[]> = [] extends A
  ? {}
  : {
      [key in ToIndex<keyof A>]: A[key];
    };

type SchemaItem<T> = {
  required?: boolean;
  converter: Converter<T>;
  defaultValue?: T;
};

type Params<R, Q> = { query: Q; route: R };

type RouterCreator<T extends Record<string, Params<any, any>> = {}> = {
  add<
    const K extends `/${string}`,
    S extends {
      [key in keyof Q]: SchemaItem<any>;
    },
    R extends { [key in ExtractParams<K>]?: any } = {},
    Q extends { [key in string]: any } = {},
  >(
    key: K extends keyof T ? never : K extends `${any}/` ? never : K,
    Component: ComponentType,
    options?: {
      query?: S & {
        [key in keyof Q]: SchemaItem<Q[key]>;
      };
      alternatives?: {
        [key in string]: ExtractParams<key> extends ExtractParams<K>
          ?
              | {
                  [key in keyof R]: key extends ExtractParams<K>
                    ? Converter<R[key]>
                    : never;
                }
              | true
          : never;
      };
    } & ({} extends R
      ? {}
      : {
          params?: {
            [key in keyof R]: key extends ExtractParams<K>
              ? Converter<R[key]>
              : never;
          };
        })
  ): RouterCreator<
    T & {
      [key in K]: Params<
        R & {
          [key in Exclude<ExtractParams<K>, keyof R>]: string;
        } & NumerableRecord<ExtractEnums<K>>,
        {
          [key in keyof S]: key extends keyof Q
            ?
                | Q[key]
                | (S[key]['required'] extends true
                    ? never
                    : S[key]['defaultValue'] extends Q[key]
                      ? never
                      : undefined)
            : never;
        }
      >;
    }
  >;
  create(): Router<T>;
};

type Router<T extends Record<string, Params<any, any>>> = {
  /** @internal */
  _unlisten(): void;

  readonly currentRoute: State<keyof T | undefined>;

  getParams<K extends keyof T>(): StateScope<T[K]['query'] & T[K]['route']>;

  push<K extends keyof T>(
    route: K,
    ...args: {} extends T[K]['query'] & T[K]['route']
      ? []
      : [params: T[K]['query'] & T[K]['route']]
  ): void;
  push<K extends keyof T>(
    path: string,
    ...args: {} extends T[K]['query'] ? [] : [params: T[K]['query']]
  ): void;

  replace<K extends keyof T>(
    route: K,
    ...args: {} extends T[K]['query'] & T[K]['route']
      ? []
      : [params: T[K]['query'] & T[K]['route']]
  ): void;
  replace<K extends keyof T>(
    path: string,
    ...args: {} extends T[K]['query'] ? [] : [params: T[K]['query']]
  ): void;
};

type SimpleOptions = {
  query?: Record<string, SchemaItem<any>>;
  alternatives?: Record<string, Record<string, Converter<any>> | true>;
  params?: Record<string, Converter<any>>;
};

const createRouter = () => {
  const map = new Map<string, Kek>();

  const currentPath = location.pathname.split('/');

  let currentRoute: string | undefined;

  let unlisten = noop;

  const create = () => ({
    _unlisten: unlisten,
    getRoute: map.get.bind(map),
    currentRoute: createSimpleState(currentRoute),
  });

  const addToMap: typeof add = (route, Component, options) => {
    const querySchema = options && options.query;

    map.set(route, {
      _component: Component,
      _key: route,
      _queryScheme: querySchema,
      _paramsConverters: options && options.params,
      _scope:
        querySchema || route.includes(':') || route.includes('|')
          ? createStateScope()
          : undefined,
    });

    return { add: addToMap, create };
  };

  const add = (
    route: string,
    Component: ComponentType,
    options?: SimpleOptions
  ) => {
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

                return { add, create };
              }
            } else {
              value = currItem;
            }

            params = { ...params, [key]: value };

            paramsNames.push(key);
          } else if (item.includes('|') && item.split('|').includes(currItem)) {
            paramsNames.push('' + orIndex);

            params = { ...params, [orIndex++]: currItem };
          } else {
            addToMap(route, Component, options);

            return { add, create };
          }
        }
      }

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

                return { add, create };
              }

              value = defaultValue;
            }

            params = { ...params, [param]: value };
          } else if (!required) {
            params = { ...params, [param]: defaultValue };
          } else {
            addToMap(route, Component, options);

            return { add, create };
          }
        }
      }

      const scope = createStateScope<any>(params);

      let isPathParamsChanged = false;

      unlisten = scope.$tate._onValueChange((value) => {
        const search = new URLSearchParams(location.search);

        if (querySchema) {
          for (const key in value) {
            if (key in querySchema) {
              search.set(key, querySchema[key].converter.stringify(value[key]));
            }
          }
        }

        const str = search.toString();

        let url = isPathParamsChanged
          ? route.replace(/:\w+/g, (match) => {
              const key = match.slice(1);

              return key in paramsConverters
                ? paramsConverters[key].stringify(value[key])
                : value[key];
            })
          : location.pathname;

        if (str) {
          url += '?' + str;
        }

        history.pushState(null, '', url);

        isPathParamsChanged = false;
      });

      const paramsNamesCount = paramsNames.length;

      if (paramsNamesCount) {
        const unlisteners = new Array<() => void>(paramsNamesCount + 1);

        for (let i = 0; i < paramsNamesCount; i++) {
          unlisteners[i] = scope[paramsNames[i]].$tate._onValueChange(() => {
            isPathParamsChanged = true;
          });
        }

        unlisteners[paramsNamesCount] = unlisten;

        unlisten = () => {
          for (let i = 0; i < unlisteners.length; i++) {
            unlisteners[i]();
          }
        };
      }

      currentRoute = route;

      map.set(route, {
        _component: Component,
        _key: route,
        _queryScheme: options && options.query,
        _paramsConverters: options && options.params,
        _scope: scope,
      });

      return { add: addToMap, create };
    }

    addToMap(route, Component, options);

    return { add, create };
  };

  return { add, create };
};

export default createRouter;
