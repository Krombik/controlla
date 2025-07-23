// import {
//   AsyncControl,
//   InternalAsyncControl,
//   UnionToIntersection,
// } from '../types';

// declare const ROUTE_MARKER: unique symbol;

// export type HandleParse = (
//   target: Record<string, any>,
//   key: string,
//   value: string | undefined,
//   source: any
// ) => boolean;

// export type HandleStringify = (value: any, key: string) => string;

// export interface Route<
//   Children extends AnyRoutes = {},
//   Params = {},
//   OptionalParams extends string = never,
//   Async extends boolean = false,
// > {
//   [ROUTE_MARKER]: [Children, Params, OptionalParams, Async];
//   /** @internal */
//   readonly _pathParams: string[];
//   /** @internal */
//   readonly _queryParams: string[];
//   /** @internal */
//   readonly _path: string[];
//   /** @internal */
//   _regexStr: string;
//   /** @internal */
//   _children: AnyRoutes | null;
//   /** @internal */
//   _source: InternalAsyncControl | null;
//   /** @internal */
//   _getParse(key: string): HandleParse;
//   /** @internal */
//   _getStringify(key: string): (value: any, key: string) => string | undefined;
//   /** @internal */
//   _replaceDeprecatedQueryParams(params: Record<string, string>): boolean;
// }

// type AnyRoutes = Record<string, Route<any, any, any, boolean>>;

// export interface PathBase<
//   Params = {},
//   OptionalParams extends string = never,
//   AsyncSource extends [any?] | [] = [],
// > extends Route<
//     {},
//     Params,
//     OptionalParams,
//     [AsyncSource[number]] extends [never] ? false : true
//   > {
//   to<Routes extends AnyRoutes>(
//     children: Routes
//   ): Route<
//     UnionToIntersection<Routes>,
//     Params,
//     OptionalParams,
//     [AsyncSource[number]] extends [never] ? false : true
//   >;
// }

// type PathAfterArray<
//   Params = {},
//   OptionalParams extends string = never,
//   QueryParams extends string = never,
//   AsyncSource extends [any?] | [] = [],
// > = PathBase<Params, OptionalParams, AsyncSource> &
//   PathAfterQuery<Params, OptionalParams, QueryParams, AsyncSource> & {
//     segment<T extends string>(
//       text: T extends `/${string}` ? never : T
//     ): PathCreator<Params, OptionalParams, QueryParams, AsyncSource>;
//     oneOf<N extends string, const T extends string[]>(
//       name: N extends keyof Params ? never : N,
//       variants: T,
//       optional?: false
//     ): PathCreator<
//       Params & {
//         [key in N]: T[number];
//       },
//       QueryParams,
//       OptionalParams,
//       AsyncSource
//     >;
//   };

// type PathAfterQuery<
//   Params = {},
//   OptionalParams extends string = never,
//   QueryParams extends string = never,
//   AsyncSource extends [any?] | [] = [],
// > = PathBase<Params, OptionalParams, AsyncSource> & {
//   query<
//     N extends string,
//     O extends boolean = false,
//     DefaultValue extends Value | (() => Value) = never,
//     Value = string,
//   >(
//     name: N extends keyof Params ? never : N,
//     options?: ParamOptions<Value, DefaultValue, O, AsyncSource>
//   ): PathAfterQuery<
//     Params &
//       (O extends true
//         ? [DefaultValue] extends [never]
//           ? { [key in N]?: Value }
//           : { [key in N]: Value }
//         : { [key in N]: Value }),
//     OptionalParams | (O extends true ? N : never),
//     QueryParams | N,
//     AsyncSource
//   > &
//     PathAfterDeprecatedQuery<Params, OptionalParams, QueryParams, AsyncSource>;
// };

// export type PathAfterDeprecatedQuery<
//   Params = {},
//   OptionalParams extends string = never,
//   QueryParams extends string = never,
//   AsyncSource extends [any?] | [] = [],
// > = PathBase<Params, OptionalParams, AsyncSource> & {
//   deprecatedQuery<const S extends string[]>(
//     keys: S,
//     mapper: (deprecatedValues: Partial<Record<S[number], string>>) => {
//       [key in Extract<keyof Params, QueryParams>]?: Params[key];
//     }
//   ): PathBase<Params, OptionalParams, AsyncSource>;
// };

// export type AsyncRoute = {
//   async<T>(
//     source: AsyncControl<T>
//   ): PathCreator<{}, never, never, [source?: T]>;
// };

// export type PathCreator<
//   Params = {},
//   OptionalParams extends string = never,
//   QueryParams extends string = never,
//   AsyncSource extends [any?] | [] = [],
// > = PathAfterArray<Params, OptionalParams, QueryParams, AsyncSource> &
//   PathAfterQuery<Params, OptionalParams, QueryParams, AsyncSource> & {
//     param<
//       N extends string,
//       O extends boolean = false,
//       DefaultValue extends Value = never,
//       Value = string,
//     >(
//       name: N extends keyof Params ? never : N,
//       options?: ParamOptions<Value, DefaultValue, O, AsyncSource>
//     ): PathCreator<
//       Params &
//         (O extends true
//           ? [DefaultValue] extends [never]
//             ? { [key in N]?: Value }
//             : { [key in N]: Value }
//           : { [key in N]: Value }),
//       OptionalParams | (O extends true ? N : never),
//       QueryParams,
//       AsyncSource
//     >;
//     array<N extends string, Value = string[]>(
//       name: N extends keyof Params ? never : N,
//       converter?: {
//         stringify?(value: Value): string[];
//         parse?(values: string[]): Value;
//       }
//     ): PathAfterArray<
//       Params & {
//         [key in N]: Value;
//       },
//       OptionalParams,
//       QueryParams,
//       AsyncSource
//     >;
//     oneOf<
//       N extends string,
//       const T extends string[],
//       DefaultValue extends T[number] = never,
//     >(
//       name: N extends keyof Params ? never : N,
//       variants: T,
//       optional: true,
//       defaultValue?: DefaultValue | (() => DefaultValue)
//     ): PathCreator<
//       Params &
//         ([DefaultValue] extends [never]
//           ? { [key in N]?: T[number] }
//           : { [key in N]: T[number] }),
//       OptionalParams | N,
//       QueryParams,
//       AsyncSource
//     >;
//   };

// export type ParamOptions<
//   Value,
//   DefaultValue,
//   O,
//   Source extends [any?] | [] = [],
// > = {
//   stringify?(value: Value): string;
//   parse?(value: string, ...args: Source): Value;
//   optional?: O;
//   isValid?(value: Value, ...args: Source): boolean;
//   defaultValue?: DefaultValue | ((...args: Source) => DefaultValue);
//   fallbackValue?:
//     | Value
//     | ((
//         incorrectValue: string | (O extends true ? never : undefined),
//         ...args: Source
//       ) => Value);
// };
