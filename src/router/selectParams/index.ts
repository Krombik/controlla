import type { RouteParams } from '#router/internal/types';
import { ROUTE_PARAMS } from '#router/internal/constants';
import type { AsyncControlScope, ControlScope } from '#types';

/**
 * Returns the control shaped like the given {@link route}'s declared params
 * (whatever `param`/`query` put there) - a regular control otherwise: read
 * it with `useValue`/`getValue`, subscribe to nested fields, and write it
 * with `setValue` (pushes a history entry) or `replaceValue` (replaces it);
 * the URL updates automatically. For an async path the value is `undefined`
 * until the source is ready.
 *
 * `setValue`/`replaceValue` throw if the route isn't matched. If a
 * `navigate()` also happens in the same tick, the write is dropped instead
 * of applying - the navigation wins.
 *
 * @example
 * ```ts
 * const $params = selectParams(router.routes.catalog);
 *
 * useValue($params.sort);
 *
 * setValue($params.sort, 'price');
 * ```
 */
const selectParams = <P extends {}, A extends boolean>(
  route: [P] extends [never] ? never : RouteParams<P, A, any>
): A extends true ? AsyncControlScope<P> : ControlScope<P> =>
  route[ROUTE_PARAMS] as any;

export default selectParams;
