import {
  ReadonlyAsyncControlScope,
  ReadonlyControlScope,
  RouteParams,
} from '../types';
import { ROUTE_PARAMS } from '../utils/constants';

const paramsOf = <P extends {}, A extends boolean>(
  route: [P] extends [never] ? never : RouteParams<P, A>
): A extends true ? ReadonlyAsyncControlScope<P> : ReadonlyControlScope<P> =>
  route[ROUTE_PARAMS] as any;

export default paramsOf;
