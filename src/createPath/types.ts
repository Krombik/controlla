import { InternalAsyncControl, UnionToIntersection } from '../types';

declare const ROUTE_MARKER: unique symbol;

declare const PATH_PARAM_MARKER: unique symbol;

declare const QUERY_PARAM_MARKER: unique symbol;

declare const SOURCE: unique symbol;

export type HandleParse = (
  target: Record<string, any>,
  key: string,
  value: string | undefined,
  source: any
) => boolean;

export type HandleStringify = (value: any, key: string) => string;

export type ParamData<V, O extends boolean> = [V, O];

export type QueryParam<
  P extends Record<string, [value: any, optional: boolean]>,
  Source = never,
> = {
  /** @internal */
  (
    parsers: Map<string, HandleParse>,
    stringifies: Map<string, HandleStringify>,
    queryParams: string[]
  ): (searchParams: Record<string, string>) => boolean;
  [QUERY_PARAM_MARKER]: P;
  [SOURCE]: Source;
};

export type QueryParamWithReplace<
  P extends Record<string, [value: any, optional: boolean]>,
  Source = never,
> = QueryParam<P> & {
  replace<const S extends string[]>(
    keys: S,
    mapper: (deprecatedValues: Partial<Record<S[number], string>>) => {
      [key in keyof P]?: string;
    }
  ): QueryParam<P, Source>;
};

export type PathParam<
  P extends Record<string, ParamData<any, boolean>>,
  Source = never,
> = {
  /** @internal */
  (
    parsers: Map<string, HandleParse>,
    stringifies: Map<string, HandleStringify>,
    pathParams: string[],
    path: string[]
  ): string;
  [PATH_PARAM_MARKER]: P;
  [SOURCE]: Source;
};

type FindChildren<P extends any[]> = P extends [...infer Head, infer Tail]
  ? Tail extends AnyPaths
    ? Tail
    : FindChildren<Head>
  : never;

type ValidatePath<T> = T extends `/${string}` | `${string}/` | '' ? never : T;

type AnyPathSegment<Source> = PathParam<Record<string, any>, Source> | string;

export type CreatePath<Source = never> = {
  <
    P extends [
      ...path: AnyPathSegment<Source>[],
      query: QueryParam<Record<string, any>, Source>,
    ],
  >(
    ...path: {
      [key in keyof P]: ValidatePath<P[key]>;
    }
  ): HandlePath<
    UnionToIntersection<
      {
        [key in keyof P]: P[key] extends PathParam<infer K, Source>
          ? K
          : P[key] extends QueryParam<infer K, Source>
            ? K
            : never;
      }[number]
    >,
    Source
  >;

  <
    P extends [
      ...path: [AnyPathSegment<Source>, ...AnyPathSegment<Source>[]],
      children: AnyPaths,
    ],
  >(
    ...path: {
      [key in keyof P]: ValidatePath<P[key]>;
    }
  ): HandlePath<
    UnionToIntersection<
      {
        [key in keyof P]: P[key] extends PathParam<infer K, Source> ? K : never;
      }[number]
    >,
    Source,
    FindChildren<P>
  >;

  <
    P extends [
      ...path: AnyPathSegment<Source>[],
      query: QueryParam<Record<string, any>, Source>,
      children: AnyPaths,
    ],
  >(
    ...path: {
      [key in keyof P]: ValidatePath<P[key]>;
    }
  ): HandlePath<
    UnionToIntersection<
      {
        [key in keyof P]: P[key] extends PathParam<infer K, Source>
          ? K
          : P[key] extends QueryParam<infer K, Source>
            ? K
            : never;
      }[number]
    >,
    Source,
    FindChildren<P>
  >;

  <P extends AnyPathSegment<Source>[]>(
    ...path: {
      [key in keyof P]: ValidatePath<P[key]>;
    }
  ): HandlePath<
    UnionToIntersection<
      {
        [key in keyof P]: P[key] extends PathParam<infer K, Source> ? K : never;
      }[number]
    >,
    Source
  >;
};

type HandlePath<
  P extends Record<string, ParamData<any, boolean>>,
  S,
  C extends AnyPaths = never,
> = Path<
  C,
  [keyof P] extends [never] ? never : { [key in keyof P]: P[key][0] },
  {
    [key in keyof P]: key extends string
      ? P[key][1] extends true
        ? key
        : never
      : never;
  }[keyof P],
  [S] extends [never] ? false : true
>;

export interface Path<
  Children extends AnyPaths = never,
  Params = never,
  OptionalParams extends string = never,
  Async extends boolean = false,
> {
  [ROUTE_MARKER]: [Children, Params, OptionalParams, Async];
  /** @internal */
  readonly _pathParams: string[];
  /** @internal */
  readonly _queryParams: string[];
  /** @internal */
  readonly _path: string[];
  /** @internal */
  readonly _regexStr: string;
  /** @internal */
  readonly _children: AnyPaths | undefined;
  /** @internal */
  readonly _source: InternalAsyncControl | undefined;
  /** @internal */
  _getParse(key: string): HandleParse;
  /** @internal */
  _getStringify(key: string): (value: any, key: string) => string | undefined;
  /** @internal */
  _replaceDeprecatedQueryParams(params: Record<string, string>): boolean;
}

export type AnyPaths = Record<string, Path<any, {}, any, boolean>>;

export type OneOfOptions<V extends string[], O> = {
  variants: V;
  optional?: O;
} & (O extends true ? { defaultValue?: V[number] } : {});

export type ArrayOptions<V> = {
  parse?(value: string[]): V;
  stringify?(value: NoInfer<V>): string[];
};

export type ParamOptions<
  Value,
  O = false,
  Source = never,
  Args extends [] | [any] = [Source] extends [never] ? [] : [source: Source],
> = {
  parse?(value: string, ...args: Args): Value;
  stringify?(value: NoInfer<Value>): string;
  optional?: O;
  fallbackValue?:
    | ((
        incorrectValue: string | (O extends true ? never : undefined),
        ...args: Args
      ) => Value)
    | Value;
  isValid?(value: NoInfer<Value>, ...args: Args): boolean;
} & (O extends true
  ? {
      defaultValue?: Value | ((...args: Args) => Value);
      // initialValue?: Value | ((...args: Args) => Value);
    }
  : {});
