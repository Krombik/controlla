import type {
  ReadonlyAsyncControlScope,
  ReadonlyControlScope,
} from '@react-control/core/types';
import type { RouteMethods, RouteParams, RouteParamsData } from '#_types';
import type { ROUTE_METHODS, ROUTE_PARAMS } from '#utils/constants';

declare const NAVIGATION_MARKER: unique symbol;

export type NavigationTarget<Navigable extends boolean = true> = {
  /** @internal */
  readonly [ROUTE_METHODS]: RouteMethods;
  /** @internal */
  readonly [ROUTE_PARAMS]?: RouteParamsData[];
  [NAVIGATION_MARKER]: Navigable;
};

export type ParamsOf<R extends RouteParams<any, any>> =
  R extends RouteParams<infer P, infer A>
    ? A extends false
      ? ReadonlyControlScope<P>
      : ReadonlyAsyncControlScope<P>
    : never;
