import type { MouseEvent as ReactMouseEvent } from 'react';
import type { ROUTE_METHODS, ROUTE_PARAMS } from '#router/internal/constants';
import type {
  AsyncControlScope,
  ControlScope,
  ReadonlyAsyncControlScope,
  ReadonlyControl,
  ReadonlyControlScope,
} from '#types';
import type {
  ControlInternals,
  AsyncControlInternals,
  PrimitiveControlInternals,
} from '#internal/types';
import type { NavigationTarget } from '#router/types';

export type UnionToIntersection<U> = (
  U extends any ? (x: U) => void : never
) extends (x: infer R) => void
  ? Required<R>
  : never;

export type IsUnion<T, U = T> = T extends any
  ? // isUnion check
    [U] extends [T]
    ? false
    : true
  : never;

export type HandleUnknown<T, Fallback> = 0 extends 1 & T
  ? T
  : unknown extends T
    ? [T] extends [unknown]
      ? Fallback
      : T
    : T;

export type Route<
  Paths = never,
  Params = never,
  Async extends boolean = false,
  Controls extends Array<ReadonlyControlScope | ReadonlyAsyncControlScope> =
    any[],
  IsPage extends boolean = [Paths] extends [never]
    ? true
    : Paths & 1 extends 0
      ? boolean
      : false,
> = RouteIsPage<IsPage> &
  RouteControls<Controls> &
  RouteParams<Params, Async> &
  ([Paths] extends [never]
    ? {}
    : {
        readonly [key in keyof Paths]: Paths[key] extends Path<
          infer C,
          infer P,
          any,
          infer A
        >
          ? Route<
              C,
              P,
              A,
              [P] extends [never]
                ? Controls
                : [
                    A extends false
                      ? ReadonlyControlScope<P>
                      : ReadonlyAsyncControlScope<P>,
                    ...Controls,
                  ]
            >
          : never;
      }) &
  ReadonlyControl<boolean>;

export type Router<Paths extends AnyPaths> = {
  readonly navigationBlocker: {
    enable(): () => void;
    disable(): void;
    readonly isPendingNavigation: ReadonlyControl<boolean> & {
      allow(): void;
      deny(): void;
    };
  };
  readonly routes: {
    readonly [key in keyof Paths]: Paths[key] extends Path<
      infer C,
      infer P,
      any,
      infer A
    >
      ? Route<
          C,
          P,
          A,
          [P] extends [never]
            ? []
            : [
                A extends false
                  ? ReadonlyControlScope<P>
                  : ReadonlyAsyncControlScope<P>,
              ]
        >
      : never;
  };
  readonly navigation: {
    [key in keyof Paths]: Paths[key] extends Path<
      infer C,
      infer P,
      infer O,
      any
    >
      ? Navigation<C, P, O>
      : never;
  };
  readonly navigationState: ReadonlyControl<NavigationState>;
};

declare const IS_PAGE_MARKER: unique symbol;

declare const CONTROLS_MARKER: unique symbol;

export type RouteIsPage<IsPage extends boolean> = {
  [IS_PAGE_MARKER]: IsPage;
  /** @internal */
  _register(setComponents: () => void): void;
};

export type RouteControls<
  Controls extends Array<ReadonlyControlScope | ReadonlyAsyncControlScope>,
> = {
  [CONTROLS_MARKER]: Controls;
  /** @internal */
  [ROUTE_METHODS](
    load: (
      ...args: Array<ReadonlyControlScope | ReadonlyAsyncControlScope>
    ) => void | Array<() => void>
  ): void;
};

declare const PARAMS_MARKER: unique symbol;

export type RouteParams<Params, Async> = {
  /** @internal */
  [ROUTE_PARAMS]: ReadonlyControlScope;
  [PARAMS_MARKER]: [Params, Async];
};

export type Navigation<
  Paths extends AnyPaths = never,
  Params = never,
  OptionalParams extends string = never,
  Children = [Paths] extends [never]
    ? {}
    : {
        [key in keyof Paths]: Paths[key] extends Path<
          infer C,
          infer P,
          infer O,
          any
        >
          ? Navigation<C, P, O>
          : never;
      },
> = ([Paths] extends [never]
  ? {}
  : {
      (): Children & NavigationTarget<false>;
    }) &
  ([Params] extends [never]
    ? [Paths] extends [never]
      ? { (): NavigationTarget<true> }
      : {}
    : {
        (
          params: ProcessParams<
            Partial<
              Pick<
                Params,
                OptionalParams extends keyof Params ? OptionalParams : never
              >
            > &
              Omit<Params, OptionalParams>
          >
        ): Children & NavigationTarget<true>;
        <
          StringifiedKeys extends keyof Params,
          StringifiedParams extends Partial<Record<keyof Params, any>> = {
            [key in keyof Params]:
              | (NonNullable<Params[key]> extends string ? Params[key] : string)
              | Extract<Params[key], undefined>;
          },
        >(
          params: ProcessParams<
            Partial<
              Pick<
                Params,
                OptionalParams extends keyof Params
                  ?
                      | OptionalParams
                      | (StringifiedKeys extends keyof Params
                          ? StringifiedKeys
                          : never)
                  : never
              >
            > &
              Omit<Params, OptionalParams | StringifiedKeys>,
            Params
          >,
          stringifiedParams: Pick<StringifiedParams, StringifiedKeys>
        ): Children & NavigationTarget<true>;
      });

export type NavigationState = {
  readonly action: 'none' | 'push' | 'replace' | 'pop';
  readonly delta: number;
};

/** @internal */
export type ParamsUpdatedData = {
  readonly _route: RouteData;
  readonly _params: Record<string, any>;
  readonly _currentPath: string;
  readonly _currentSearch: string;
};

/** @internal */
export type RouteData = {
  readonly _selfIndex: number;
  readonly _params: ControlInternals | AsyncControlInternals | null;
  readonly _source: AsyncControlInternals | undefined;
  readonly _isMatched: PrimitiveControlInternals;
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
    params: Record<string, any>,
    stringifiedParams: Record<string, any>,
    source: any
  ): boolean;
  _extractQueryParams(
    target: Record<string, any>,
    params: Record<string, any>,
    stringifiedParams: Record<string, string>,
    source: any
  ): boolean;
  _replaceDeprecatedQueryParams(searchParams: Record<string, string>): boolean;
  _currentPath: string;
  _currentSearch: string;
  _load(): void;
  _unload(): void;
};

/** @internal */
export type RouteParamsData = {
  readonly _route: RouteData;
  readonly _params: ProcessParams<Record<string, any>> | null;
  readonly _stringifiedParams?: Record<string, string>;
};

/** @internal */
export type RouteMethods = {
  _useHref(
    params: RouteParamsData[] | undefined,
    useParams: (route: RouteData) => void,
    useNoop: () => void
  ): string;
  _navigate(
    event: ReactMouseEvent<HTMLAnchorElement, any> | null,
    params?: RouteParamsData[],
    replace?: boolean,
    ignoreBlock?: boolean,
    enableScrollToTop?: boolean,
    enableScrollRestoration?: boolean,
    onClick?: (event: ReactMouseEvent<HTMLAnchorElement, any>) => void
  ): void;
  readonly _isMatched: PrimitiveControlInternals;
};

export type ProcessParams<O, P = O> = O | ((prev: P) => O);

declare const ROUTE_MARKER: unique symbol;

declare const PATH_PARAM_MARKER: unique symbol;

declare const QUERY_PARAM_MARKER: unique symbol;

declare const SOURCE: unique symbol;

/** @internal */
export type HandleParse = (
  target: Record<string, any>,
  key: string,
  value: string | undefined,
  source: any
) => boolean;

/** @internal */
export type HandleStringify = (value: any, key: string) => string;

type ParamData<V, O extends boolean> = [V, O];

type QueryParam<
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
> = QueryParam<P, Source> & {
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
  [ROUTE_MARKER]: [
    UnionToIntersection<Children>,
    Params,
    OptionalParams,
    Async,
  ];
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
  readonly _source: AsyncControlInternals | undefined;
  /** @internal */
  _createControlScope(): ControlScope | AsyncControlScope;
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

export type ParamOptions<Value, O = false, Source = never> = {
  parse?(value: string, source: Source): Value;
  stringify?(value: NoInfer<Value>): string;
  optional?: O;
  fallbackValue?:
    | ((
        incorrectValue: string | (O extends true ? never : undefined),
        source: Source
      ) => Value)
    | Value;
  isValid?(value: NoInfer<Value>, source: Source): boolean;
} & (O extends true
  ? {
      defaultValue?: Value | ((source: Source) => Value);
      // initialValue?: Value | ((source: Source) => Value);
    }
  : {});

export type ValidateParams<P> = keyof P extends {
  [key in keyof P]: P[key] extends boolean | ParamOptions<any, any, any>
    ? key
    : never;
}[keyof P]
  ? unknown
  : never;
