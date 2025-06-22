import type { RouteBase } from '../createRouter';
import { ROUTE_METHODS, ROUTE_PARAMS } from '../utils/constants';

const navigate = (
  to: RouteBase<true>,
  replace?: boolean,
  ignoreBlock?: boolean,
  scrollToTop?: boolean,
  scrollRestoration?: boolean
) => {
  to[ROUTE_METHODS]._navigate(
    null,
    to[ROUTE_PARAMS],
    replace,
    ignoreBlock,
    scrollToTop,
    scrollRestoration
  );
};

export default navigate;
