// import identity from 'lodash.identity';
// import { ROOT } from '../utils/constants';
// import alwaysTrue from '../utils/alwaysTrue';
// import alwaysFalse from '../utils/alwaysFalse';
// import type {
//   AsyncRoute,
//   HandleParse,
//   HandleStringify,
//   ParamOptions,
//   PathAfterDeprecatedQuery,
//   PathCreator,
//   Route,
// } from './types';

// const parseArray = (value: string) => value.split('/');

// const stringifyArray = (value: string[], key: string) => {
//   if (!value.length) {
//     throw new Error(`${key} is empty`);
//   }

//   return value.join('/');
// };

// const nonUndefinedIdentity = (value: any, key: string) => {
//   if (value === undefined) {
//     throw new Error(`${key} is required`);
//   }

//   return value;
// };

// const handleStringify = (
//   stringify: ((value: any) => string) | undefined,
//   optional: boolean | undefined,
//   defaultValue: undefined | unknown | (() => unknown)
// ): HandleStringify => {
//   if (optional) {
//     const getDefaultValue =
//       defaultValue !== undefined &&
//       (typeof defaultValue != 'function' ? () => defaultValue : defaultValue);

//     return stringify
//       ? getDefaultValue
//         ? (value) => stringify(value !== undefined ? value : getDefaultValue())
//         : (value) => (value !== undefined ? stringify(value) : value)
//       : getDefaultValue
//         ? (value) => (value !== undefined ? value : getDefaultValue())
//         : identity;
//   }

//   return stringify
//     ? (value, key) => stringify(nonUndefinedIdentity(value, key))
//     : nonUndefinedIdentity;
// };

// const simpleParse: HandleParse = (target, key, value) => {
//   target[key] = value;

//   return false;
// };

// const handleParse = (
//   name: string,
//   optional: boolean | undefined,
//   parse: ((value: string | undefined, source: any) => any) | undefined,
//   isValid: ((value: any, source: any) => boolean) | undefined,
//   defaultValue: undefined | unknown | ((source: any) => unknown),
//   fallbackValue: undefined | unknown | ((source: any) => unknown)
// ): HandleParse => {
//   if (
//     optional &&
//     !parse &&
//     !isValid &&
//     defaultValue === undefined &&
//     fallbackValue === undefined
//   ) {
//     return simpleParse;
//   }

//   parse ||= identity;

//   isValid ||= alwaysTrue;

//   const getFallbackValue = (
//     typeof fallbackValue != 'function'
//       ? optional || fallbackValue !== undefined
//         ? () => fallbackValue
//         : (_, __, error) => {
//             throw error || new Error(`${name} is not valid`);
//           }
//       : fallbackValue
//   ) as (incorrectValue: string | undefined, source: any, error?: any) => any;

//   const getDefaultValue = (
//     typeof defaultValue != 'function' ? () => defaultValue : defaultValue
//   ) as (source: any) => unknown;

//   const safeParse: HandleParse = (target, key, value, source) => {
//     let err;

//     try {
//       const parsed = parse(nonUndefinedIdentity(value, key), source);

//       if (isValid(parsed, source)) {
//         target[key] = parsed;

//         return false;
//       }
//     } catch (error) {
//       err = error;
//     }

//     const fallbackValue = getFallbackValue(value, source, err);

//     target[key] =
//       fallbackValue !== undefined ? fallbackValue : getDefaultValue(source);

//     return true;
//   };

//   return optional
//     ? (target, key, value, source) => {
//         if (value) {
//           return safeParse(target, key, value, source);
//         }

//         const defaultValue = getDefaultValue(source);

//         target[key] = defaultValue;

//         return defaultValue !== undefined;
//       }
//     : safeParse;
// };

// const createRoute = (): PathCreator & AsyncRoute => {
//   const parsers = new Map<string, HandleParse>();

//   const stringifies = new Map<string, HandleStringify>();

//   const getStringify = stringifies.get.bind(stringifies);

//   return {
//     _children: null,
//     _getParse: parsers.get.bind(parsers),
//     _getStringify: getStringify,
//     _replaceDeprecatedQueryParams:
//       alwaysFalse as Route['_replaceDeprecatedQueryParams'],
//     _path: [] as string[],
//     _pathParams: [] as string[],
//     _queryParams: [] as string[],
//     _source: null,
//     async(source) {
//       this._source = source[ROOT];

//       return this as any;
//     },
//     segment(text: string) {
//       text = '/' + text;

//       const path = this._path;

//       const l = path.length;

//       if (l && path[l - 1][0] == '/') {
//         path[l - 1] += text;
//       } else {
//         path.push(text);
//       }

//       this._regexStr += text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

//       return this as any;
//     },
//     param(
//       name,
//       {
//         parse,
//         stringify,
//         isValid,
//         optional,
//         fallbackValue,
//         defaultValue,
//       }: ParamOptions<unknown, unknown, boolean, [any]> = {}
//     ) {
//       const pattern = `/(?<${name}>[^/]+)`;

//       parsers.set(
//         name,
//         handleParse(name, optional, parse, isValid, defaultValue, fallbackValue)
//       );

//       stringifies.set(name, handleStringify(stringify, optional, defaultValue));

//       this._path.push(name);

//       this._pathParams.push(name);

//       this._regexStr += optional ? `(?:${pattern})?` : pattern;

//       return this as any;
//     },
//     array(name, converter) {
//       const stringify = converter && converter.stringify;

//       const parse = (converter && converter.parse) || identity;

//       parsers.set(name, (target, key, value) => {
//         target[key] = parse(parseArray(value!));

//         return false;
//       });

//       stringifies.set(
//         name,
//         stringify
//           ? (value, name) => stringifyArray(stringify(value), name)
//           : stringifyArray
//       );

//       this._path.push(name);

//       this._pathParams.push(name);

//       this._regexStr += `(?:/(?<${name}>(?:[^/]+(?:/[^/]+)*)))?`;

//       return this as any;
//     },
//     oneOf(
//       name: string,
//       variants: string[],
//       optional?: boolean,
//       defaultValue?: string
//     ) {
//       const pattern = `/(?<${name}>(?:${variants
//         .map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
//         .join('|')}))`;

//       const set = new Set(variants);

//       const isCorrectVariant = set.has.bind(set);

//       parsers.set(
//         name,
//         optional && defaultValue
//           ? (target, key, value) => {
//               target[key] = value || defaultValue;

//               return !value && !!defaultValue;
//             }
//           : simpleParse
//       );

//       stringifies.set(
//         name,
//         optional
//           ? (value, key) => {
//               value ||= defaultValue;

//               if (value === undefined || isCorrectVariant(value)) {
//                 return value;
//               }

//               throw new Error(`${key} has incorrect "${value}" variant`);
//             }
//           : (value, key) => {
//               if (isCorrectVariant(nonUndefinedIdentity(value, key))) {
//                 return value;
//               }

//               throw new Error(`${key} has incorrect "${value}" variant`);
//             }
//       );

//       this._path.push(name);

//       this._pathParams.push(name);

//       this._regexStr += optional ? `(?:${pattern})?` : pattern;

//       return this as any;
//     },
//     query(
//       name,
//       {
//         parse,
//         stringify,
//         isValid,
//         optional,
//         fallbackValue,
//         defaultValue,
//       }: ParamOptions<unknown, unknown, boolean, [any]> = {}
//     ) {
//       parsers.set(
//         name,
//         handleParse(name, optional, parse, isValid, defaultValue, fallbackValue)
//       );

//       stringifies.set(name, handleStringify(stringify, optional, defaultValue));

//       this._queryParams.push(name);

//       return this as any;
//     },
//     deprecatedQuery(keys, mapper) {
//       this._replaceDeprecatedQueryParams = (searchParams) => {
//         let replaced = false;

//         const obj: Record<string, string> = {};

//         for (let i = 0; i < keys.length; i++) {
//           const key = keys[i];

//           const value = searchParams[key];

//           if (value) {
//             replaced = true;

//             obj[key] = value;
//           }
//         }

//         if (replaced) {
//           try {
//             const params = mapper(obj as any);

//             for (const key in params) {
//               if (!(key in searchParams)) {
//                 const param = params[key as keyof typeof params];

//                 try {
//                   const value = getStringify(key)!(param, key);

//                   if (value) {
//                     searchParams[key] = value;
//                   }
//                 } catch {}
//               }
//             }
//           } catch {}
//         }

//         return replaced;
//       };

//       return this as any;
//     },
//     to(children) {
//       this._children = children;

//       return this as any;
//     },
//   } as PathCreator & AsyncRoute & PathAfterDeprecatedQuery;
// };

// export default createRoute;
