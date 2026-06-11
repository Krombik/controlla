import type { RouteControls } from '#router/internal/types';
import { ROUTE_METHODS } from '#router/internal/constants';

const onMatched = <const C extends any[], A extends Partial<C>>(
  route: RouteControls<C>,
  cb: (
    ...params: { [key in keyof A]-?: NonNullable<A[key]> }
  ) => void | Array<() => void>
) => {
  route[ROUTE_METHODS](cb);
};

export default onMatched;
