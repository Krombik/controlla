import type { AsyncControlScope, Control, ControlScope } from '#types';
import type {
  Hash,
  RouteMethods,
  RouteParams,
  TargetParams,
} from '#router/internal/types';
import type {
  ROUTE_METHODS,
  ROUTE_PARAMS,
  ROUTE_HASH,
} from '#router/internal/constants';

declare const NAVIGATION_MARKER: unique symbol;

export type NavigationTarget<Navigable extends boolean = true> = {
  /** @internal */
  readonly [ROUTE_METHODS]: RouteMethods;
  /** @internal */
  readonly [ROUTE_PARAMS]?: TargetParams[];
  /** @internal */
  readonly [ROUTE_HASH]?: Hash;
  [NAVIGATION_MARKER]: Navigable;
};

export type SelectParams<R extends RouteParams<any, any, any>> =
  R extends RouteParams<infer P, infer A, any>
    ? A extends false
      ? ControlScope<P>
      : AsyncControlScope<P>
    : never;

export type SelectAnchor<R extends RouteParams<any, any, string>> =
  R extends RouteParams<any, any, infer A> ? Control<A | ''> : never;
