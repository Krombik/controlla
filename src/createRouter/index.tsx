// import type { ComponentType } from 'react';
// import type {
//   Converter,
//   StateBase as State,
//   StateScope,
//   ToIndex,
// } from '../types';
// import createStateScope from '../createStateScope';
// import noop from 'lodash.noop';
// import createSimpleState from '../utils/createSimpleState';
// // import createSimpleState from '../utils/createSimpleState';

// type Route = {
//   readonly _key: string;
//   readonly _component: ComponentType;
//   readonly _scope: StateScope | undefined;
//   readonly _queryScheme: Record<string, SchemaItem<any>> | undefined;
//   readonly _paramsConverters: Record<string, Converter<any>>;
//   readonly _pathMap: Array<string | string[]>;
//   _path: string;
//   readonly _queryParams: Map<string, string> | undefined;
// };

// type ExtractParams<T extends string> =
//   T extends `${any}:${infer Param}/${infer Rest}`
//     ? Param | ExtractParams<Rest>
//     : T extends `${any}:${infer Param}`
//       ? Param
//       : never;

// type TakeAll<T extends string> = T extends `${infer K}|${infer Rest}`
//   ? K | (Rest extends `${any}|${any}` ? TakeAll<Rest> : Rest)
//   : never;

// type ExtractEnums<
//   T extends string,
//   Arr extends string[] = [],
// > = T extends `/${infer First}/${infer K}`
//   ? First extends `${any}|${any}`
//     ? [...Arr, TakeAll<First>, ...ExtractEnums<`/${K}`, Arr>]
//     : [...Arr, ...ExtractEnums<`/${K}`, Arr>]
//   : T extends `/${infer First}`
//     ? First extends `${any}|${any}`
//       ? [...Arr, TakeAll<First>]
//       : Arr
//     : [];

// type NumerableRecord<A extends any[]> = [] extends A
//   ? {}
//   : {
//       [key in ToIndex<keyof A>]: A[key];
//     };

// type SchemaItem<T> = {
//   required?: boolean;
//   converter: Converter<T>;
//   defaultValue?: T;
// };

// type Params<R extends {}, Q extends {}> = { query: Q; route: R };

// type RouterCreator<T extends Record<string, Params<any, any>> = {}> = {
//   add<
//     const K extends `/${string}`,
//     S extends {
//       [key in keyof Q]: SchemaItem<any>;
//     },
//     R extends { [key in ExtractParams<K>]?: any } = {},
//     Q extends { [key in string]: any } = {},
//   >(
//     key: K extends keyof T ? never : K extends `${any}/` ? never : K,
//     Component: ComponentType,
//     options?: {
//       query?: S & {
//         [key in keyof Q]: SchemaItem<Q[key]>;
//       };
//       alternatives?: {
//         [key in string]: ExtractParams<key> extends ExtractParams<K>
//           ?
//               | {
//                   [key in keyof R]: key extends ExtractParams<K>
//                     ? Converter<R[key]>
//                     : never;
//                 }
//               | true
//           : never;
//       };
//       startsWith?: boolean;
//     } & ({} extends R
//       ? {}
//       : {
//           params?: {
//             [key in keyof R]: key extends ExtractParams<K>
//               ? Converter<R[key]>
//               : never;
//           };
//         })
//   ): RouterCreator<
//     T & {
//       [key in K]: Params<
//         R & {
//           [key in Exclude<ExtractParams<K>, keyof R>]: string;
//         } & NumerableRecord<ExtractEnums<K>>,
//         {
//           [key in keyof S]: key extends keyof Q
//             ?
//                 | Q[key]
//                 | (S[key]['required'] extends true
//                     ? never
//                     : S[key]['defaultValue'] extends Q[key]
//                       ? never
//                       : undefined)
//             : never;
//         }
//       >;
//     }
//   >;
//   create(): Router<T>;
// };

// type Path = {
//   /** @internal */
//   readonly _route: Route;
//   /** @internal */
//   readonly _path: string | undefined;
//   /** @params */
//   readonly _params: Trr<Record<string, unknown>> | undefined;
// };

// interface Navigation {
//   /** @internal */
//   readonly _router: Router<any>;

//   /** @internal */
//   readonly _items: Path[];

//   concat<R extends Router<any>, K extends R[typeof ROUTER_MARKER]>(
//     router: R,
//     route: K,
//     ...args: R extends Router<infer T>
//       ? T[K extends keyof T ? K : never] extends Params<infer P, infer Q>
//         ? {} extends P & Q
//           ? []
//           : [params: Trr<P & Q>]
//         : never
//       : never
//   ): this;
//   concat<R extends Router<any>, K extends R[typeof ROUTER_MARKER]>(
//     router: R,
//     route: K,
//     path: string,
//     ...args: R extends Router<infer T>
//       ? T[K extends keyof T ? K : never] extends Params<any, infer Q>
//         ? {} extends Q
//           ? []
//           : [params: Trr<Q>]
//         : never
//       : never
//   ): this;
//   navigate(replace?: boolean): void;
// }

// declare const ROUTER_MARKER: unique symbol;

// type Trr<T extends {}> = { [key in keyof T]: T[key] | State<T[key]> };

// type Router<T extends Record<string, Params<any, any>>> = {
//   [ROUTER_MARKER]: keyof T;

//   /** @internal */
//   _getRoute(key: string): Route | undefined;

//   /** @internal */
//   _isMounted: boolean;

//   /** @internal */
//   _parent: Router<any> | null;

//   readonly currentRoute: State<keyof T | undefined>;

//   getParams<K extends keyof T>(): {} extends T[K]['query'] & T[K]['route']
//     ? undefined
//     : StateScope<T[K]['query'] & T[K]['route']>;

//   nav<K extends keyof T>(
//     route: K,
//     ...args: {} extends T[K]['query'] & T[K]['route']
//       ? []
//       : [params: Trr<T[K]['query'] & T[K]['route']>]
//   ): Navigation;
//   nav<K extends keyof T>(
//     route: K,
//     path: string,
//     ...args: {} extends T[K]['query'] ? [] : [params: Trr<T[K]['query']>]
//   ): Navigation;
// };

// const k = null! as Router<{
//   '/awdwadwa/:kek': Params<{ kek: string }, { eee: number }>;
// }>;

// k.nav('/awdwadwa/:kek', { kek: 'awd', eee: 123 }).concat(k, '/awdwadwa/:kek', {
//   kek: 'awd',
//   eee: 123,
// });

// type SimpleOptions = {
//   query?: Record<string, SchemaItem<any>>;
//   alternatives?: Record<string, Record<string, Converter<any>> | true>;
//   params?: Record<string, Converter<any>>;
//   startsWith?: boolean;
// };

// function getParams(this: Router<any>) {
//   const self = this;

//   const route = self.currentRoute._value;

//   return route && self._getRoute(route)!._scope;
// }

// function concat(
//   this: Navigation,
//   router: Router<any>,
//   route: string,
//   arg1?: string | Record<string, any>,
//   arg2?: Record<string, any>
// ) {
//   const self = this;

//   self._items.push(
//     typeof arg1 == 'string'
//       ? { _route: router._getRoute(route)!, _params: arg2, _path: arg1 }
//       : {
//           _route: router._getRoute(route)!,
//           _params: arg1,
//           _path: undefined,
//         }
//   );

//   return self;
// }

// function navigate(this: Navigation, replace?: boolean) {
//   const { _router, _items } = this;

//   let parent = _router._parent;

//   let url = '';

//   const search = new URLSearchParams();

//   while (parent) {
//     const { _path, _queryScheme, _queryParams } = parent._getRoute(
//       parent.currentRoute._value
//     )!;

//     url = '/' + _path + url;

//     if (_queryScheme) {
//       for (const key in _queryScheme) {
//         if (_queryParams!.has(key)) {
//           search.set(key, _queryParams!.get(key)!);
//         }
//       }
//     }

//     parent = parent._parent;
//   }

//   for (let i = 0; i < _items.length; i++) {
//     const {
//       _params,
//       _route: { _paramsConverters, _queryScheme, _pathMap },
//       _path,
//     } = _items[i];

//     let orIndex = 0;

//     if (_path) {
//       url += _path;

//       const p = _path.split('/');

//       if (_pathMap.length == p.length) {
//         for (let i = 0; i < p.length; i++) {
//           const item = _pathMap[i];

//           if (typeof item == 'object') {
//           }
//         }
//       }
//     } else {
//       for (let i = 0; i < _pathMap.length; i++) {
//         const p = _pathMap[i];

//         if (typeof p == 'string') {
//           url += '/' + p;
//         } else if (p.length == 1) {
//           const key = p[0];

//           const item = _params![key];

//           url +=
//             '/' +
//             (key in _paramsConverters
//               ? _paramsConverters[key].stringify(item)
//               : item);
//         } else {
//           url += '/' + _params![orIndex++];
//         }
//       }
//     }

//     if (_queryScheme) {
//       for (const key in _queryScheme) {
//         const item = _queryScheme[key];

//         const param = _params![key];

//         if (param !== undefined) {
//           search.set(key, item.converter.stringify(param));
//         } else if (item.required) {
//           throw new Error(`${key} is missed`);
//         }
//       }
//     }
//   }

//   if (search.size) {
//     url += '?' + search.toString();
//   }

//   history[replace ? 'replaceState' : 'pushState'](null, '', url);
// }

// function nav(
//   this: Router<any>,
//   route: string,
//   arg1?: string | Record<string, any>,
//   arg2?: Record<string, any>
// ): Navigation {
//   const self = this;

//   return {
//     _items: [
//       typeof arg1 == 'string'
//         ? { _route: self._getRoute(route)!, _params: arg2, _path: arg1 }
//         : {
//             _route: self._getRoute(route)!,
//             _params: arg1,
//             _path: undefined,
//           },
//     ],
//     _router: self,
//     concat,
//     navigate,
//   };
// }

// const createRouter = (): RouterCreator => {
//   const map = new Map<string, Route>();

//   const currentPath = location.pathname.split('/');

//   const currentRoute = createSimpleState() as State<string | undefined>;

//   const router = {
//     currentRoute,
//     _getRoute: map.get.bind(map),
//     _parent: null,
//     _isMounted: false,
//     getParams,
//     nav,
//   } as Router<any>;

//   function addToMap<T>(
//     this: T,
//     route: string,
//     Component: ComponentType,
//     options: SimpleOptions
//   ) {
//     const querySchema = options && options.query;

//     const path: Route['_pathMap'] = [];

//     const p = route.split('/');

//     for (let i = 1; i < p.length; i++) {
//       const item = p[i];

//       path.push(
//         item[0] == ':'
//           ? [item.slice(1)]
//           : item.includes('|')
//             ? item.split('|')
//             : item
//       );
//     }

//     map.set(route, {
//       _component: Component,
//       _key: route,
//       _queryScheme: querySchema,
//       _paramsConverters: (options && options.params) || {},
//       _scope:
//         querySchema || route.includes(':') || route.includes('|')
//           ? createStateScope()
//           : undefined,
//       _pathMap: path,
//     });

//     return this;
//   }

//   return {
//     create: () => router,
//     add(route, Component, options: SimpleOptions) {
//       const self = this;

//       const path = route.split('/');

//       const l = path.length;

//       if (l == currentPath.length) {
//         let params: undefined | object;

//         let orIndex = 0;

//         const querySchema = options && options.query;

//         const paramsNames: string[] = [];

//         const paramsConverters = (options && options.params) || {};

//         for (let i = 1; i < l; i++) {
//           const item = path[i];

//           const currItem = currentPath[i];

//           if (item != currItem || item != '_') {
//             if (item[0] == ':') {
//               const key = item.slice(1);

//               let value;

//               if (key in paramsConverters) {
//                 try {
//                   value = paramsConverters[key].parse(currItem);
//                 } catch {
//                   addToMap(key, Component, options);

//                   return self;
//                 }
//               } else {
//                 value = currItem;
//               }

//               params = { ...params, [key]: value };

//               paramsNames.push(key);
//             } else if (
//               item.includes('|') &&
//               item.split('|').includes(currItem)
//             ) {
//               paramsNames.push('' + orIndex);

//               params = { ...params, [orIndex++]: currItem };
//             } else {
//               addToMap(route, Component, options);

//               return self;
//             }
//           }
//         }

//         currentRoute._value = route;

//         if (querySchema) {
//           const search = new URLSearchParams(location.search);

//           for (const param in querySchema) {
//             const { converter, defaultValue, required } = querySchema[param];

//             const strValue = search.get(param);

//             if (strValue != null) {
//               let value;

//               try {
//                 value = converter.parse(strValue);
//               } catch {
//                 if (required) {
//                   addToMap(route, Component, options);

//                   return self;
//                 }

//                 value = defaultValue;
//               }

//               params = { ...params, [param]: value };
//             } else if (!required) {
//               params = { ...params, [param]: defaultValue };
//             } else {
//               addToMap(route, Component, options);

//               return self;
//             }
//           }
//         }

//         const scope = createStateScope<any>(params);

//         let isPathParamsChanged = false;

//         const unlisteners = [
//           scope.$tate._onValueChange((value) => {
//             const search = new URLSearchParams(location.search);

//             if (querySchema) {
//               for (const key in value) {
//                 if (key in querySchema) {
//                   search.set(
//                     key,
//                     querySchema[key].converter.stringify(value[key])
//                   );
//                 }
//               }
//             }

//             const str = search.toString();

//             let href = location.pathname;

//             if (isPathParamsChanged) {
//             }

//             let url = isPathParamsChanged
//               ? route.replace(/:\w+/g, (match) => {
//                   const key = match.slice(1);

//                   return key in paramsConverters
//                     ? paramsConverters[key].stringify(value[key])
//                     : value[key];
//                 })
//               : location.pathname;

//             if (str) {
//               href += '?' + str;
//             }

//             history.pushState(null, '', href);

//             isPathParamsChanged = false;
//           }),
//         ];

//         const fn = () => {
//           isPathParamsChanged = true;
//         };

//         for (let i = 0; i < paramsNames.length; i++) {
//           unlisteners.push(scope[paramsNames[i]].$tate._onValueChange(fn));
//         }

//         unlisteners.push(
//           currentRoute._onValueChange(() => {
//             for (let i = 0; i < unlisteners.length; i++) {
//               unlisteners[i]();
//             }
//           })
//         );

//         map.set(route, {
//           _component: Component,
//           _key: route,
//           _queryScheme: options && options.query,
//           _paramsConverters: options && options.params,
//           _scope: scope,
//         });

//         self.add = addToMap;

//         return self;
//       }

//       addToMap(route, Component, options);

//       return self;
//     },
//   };
// };

// export default createRouter;
