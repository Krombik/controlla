import type { RouteParams } from '#router/internal/types';
import { ROUTE_PARAMS } from '#router/internal/constants';
import type { ReadonlyAsyncControlScope, ReadonlyControlScope } from '#types';

const selectParams = <P extends {}, A extends boolean>(
  route: [P] extends [never] ? never : RouteParams<P, A>
): A extends true ? ReadonlyAsyncControlScope<P> : ReadonlyControlScope<P> =>
  route[ROUTE_PARAMS] as any;

export default selectParams;
