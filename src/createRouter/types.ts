import type { MouseEvent as ReactMouseEvent } from 'react';
import type {
  InternalAsyncControl,
  InternalControl,
  ReadonlyAsyncControlScope,
  ReadonlyControl,
  ReadonlyControlScope,
} from '../types';
import type { ROUTE_METHODS, ROUTE_PARAMS } from '../utils/constants';
import type { AnyPaths, Path } from '../createPath/types';

declare const ROUTE_MARKER: unique symbol;

declare const NAVIGATION_MARKER: unique symbol;

export type NavigationTarget<Navigable extends boolean> = {
  /** @internal */
  readonly [ROUTE_METHODS]: RouteMethods;
  /** @internal */
  readonly [ROUTE_PARAMS]?: RouteParams[];
  [NAVIGATION_MARKER]: Navigable;
};

export type Router<Paths extends AnyPaths & { 404?: true }> = {
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

export type Route<
  Paths = never,
  Params = never,
  Async extends boolean = false,
  Controls extends Array<
    ReadonlyControlScope | ReadonlyAsyncControlScope
  > = any[],
  IsChildless extends boolean = [Paths] extends [never]
    ? true
    : Paths & 1 extends 0
      ? boolean
      : false,
> = {
  [ROUTE_MARKER]: [IsChildless, Controls];
  /** @internal */
  [ROUTE_METHODS](
    load: (
      ...args: Array<ReadonlyControlScope | ReadonlyAsyncControlScope>
    ) => void | Array<() => void>
  ): void;
} & ([Paths] extends [never]
  ? {
      /** @internal */
      _register(setComponents: () => void): void;
    }
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
  ReadonlyControl<boolean> &
  ([Params] extends [never]
    ? {}
    : {
        [ROUTE_PARAMS]: Async extends false
          ? ReadonlyControlScope<Params>
          : ReadonlyAsyncControlScope<Params>;
      });

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
            {
              [key in Exclude<
                keyof Params,
                OptionalParams
              > as keyof Params]: Params[key];
            } & {
              [key in Extract<
                keyof Params,
                OptionalParams
              > as keyof Params]?: Params[key];
            }
          >
        ): Children & NavigationTarget<true>;
        <
          P extends {
            [key in keyof Params]?: Params[key];
          } = never,
        >(
          params: ProcessParams<P, Params> | null,
          stringifiedParams: {
            [key in Exclude<
              keyof Params,
              OptionalParams | keyof P
            > as keyof Params]: Params[key] extends string
              ? Params[key]
              : string;
          } & {
            [key in Extract<
              keyof Params,
              OptionalParams | keyof P
            > as keyof Params]?: NonNullable<Params[key]> extends string
              ? Params[key]
              : string;
          }
        ): Children & NavigationTarget<true>;
      });

export type NavigationState = {
  readonly action: 'none' | 'push' | 'replace' | 'pop';
  readonly delta: number;
};

export type ParamsUpdatedData = {
  readonly _route: RouteData;
  readonly _params: Record<string, any>;
  readonly _currentPath: string;
  readonly _currentSearch: string;
};

export type RouteData = {
  readonly _selfIndex: number;
  readonly _params: InternalControl | InternalAsyncControl | null;
  readonly _source: InternalAsyncControl | undefined;
  readonly _isMatched: InternalControl<boolean>;
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
};

export type RouteParams = {
  readonly _route: RouteData;
  readonly _params: ProcessParams<Record<string, any>> | null;
  readonly _stringifiedParams?: Record<string, string>;
};

export type RouteMethods = {
  _useHref(
    params: RouteParams[] | undefined,
    useParams: (route: RouteData) => void,
    useNoop: () => void
  ): string;
  _navigate(
    event: ReactMouseEvent<HTMLAnchorElement, any> | null,
    params?: RouteParams[],
    replace?: boolean,
    ignoreBlock?: boolean,
    enableScrollToTop?: boolean,
    enableScrollRestoration?: boolean,
    onClick?: (event: ReactMouseEvent<HTMLAnchorElement, any>) => void
  ): void;
  readonly _isMatched: InternalControl<boolean>;
};

export type ProcessParams<O, P = O> = O | ((prev: P) => O);
