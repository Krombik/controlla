// import type { ComponentType } from 'react';
// import type {
//   Converter,
//   Navigation,
//   Route,
//   Router,
//   RouterCreator,
//   SchemaItem,
//   StateBase as State,
// } from '../types';
// import createStateScope from '../createStateScope';
// import noop from 'lodash.noop';
// import createSimpleState from '../utils/createSimpleState';

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
//     const item = _items[i];

//     const {
//       _route: { _paramsConverters, _queryScheme, _pathMap },
//       _path,
//     } = item;

//     let _params = item._params;

//     let orIndex = 0;

//     if (_path) {
//       url += _path;

//       const p = _path.split('/');

//       let orIndex = 0;

//       for (let i = 0; i < p.length; i++) {
//         const item = _pathMap[i];

//         if (typeof item == 'object') {
//           if (item.length == 1) {
//             const key = item[0];

//             _params = {
//               ..._params,
//               [key]:
//                 key in _paramsConverters
//                   ? _paramsConverters[key].parse(p[i])
//                   : p[i],
//             };
//           } else {
//             _params = { ..._params, [orIndex++]: p[i] };
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
