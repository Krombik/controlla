import type { RouteParams } from '#_types';
import { ROUTE_PARAMS } from '#utils/constants';
import type {
  ReadonlyAsyncControlScope,
  ReadonlyControlScope,
} from '@react-control/core/types';

const paramsOf = <P extends {}, A extends boolean>(
  route: [P] extends [never] ? never : RouteParams<P, A>
): A extends true ? ReadonlyAsyncControlScope<P> : ReadonlyControlScope<P> =>
  route[ROUTE_PARAMS] as any;

export default paramsOf;
