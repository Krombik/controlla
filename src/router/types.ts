import type { ReadonlyAsyncControlScope, ReadonlyControlScope } from '#types';
import type {
  Hash,
  RouteMethods,
  RouteParams,
  RouterParamUpdates,
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
  readonly [ROUTE_PARAMS]?: RouterParamUpdates[];
  /** @internal */
  readonly [ROUTE_HASH]?: Hash;
  [NAVIGATION_MARKER]: Navigable;
};

export type ParamsOf<R extends RouteParams<any, any>> =
  R extends RouteParams<infer P, infer A>
    ? A extends false
      ? ReadonlyControlScope<P>
      : ReadonlyAsyncControlScope<P>
    : never;
