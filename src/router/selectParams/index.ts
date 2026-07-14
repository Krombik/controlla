import type { RouteParams } from '#router/internal/types';
import { ROUTE_PARAMS } from '#router/internal/constants';
import type { AsyncControlScope, ControlScope } from '#types';

const selectParams = <P extends {}, A extends boolean>(
  route: [P] extends [never] ? never : RouteParams<P, A, any>
): A extends true ? AsyncControlScope<P> : ControlScope<P> =>
  route[ROUTE_PARAMS] as any;

export default selectParams;
