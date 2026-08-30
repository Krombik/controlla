import type { NavigationTarget } from '#router/types';
import type { Navigate } from '~platform/navigate';
import {
  ROUTE_METHODS,
  ROUTE_PARAMS,
  ROUTE_HASH,
} from '#router/internal/constants';
import navigateRoute from '#router/internal/navigateRoute';

// the parameters are spelled out rather than taken from `Navigate`: the branch
// this target drops still has to compile, and there the type is the other one
const navigate = (
  __NATIVE__
    ? (
        to: NavigationTarget<true>,
        replace?: boolean,
        ignoreBlock?: boolean
      ) => {
        navigateRoute(
          to[ROUTE_METHODS],
          to[ROUTE_PARAMS],
          replace || false,
          ignoreBlock
        );
      }
    : (
        to: NavigationTarget<true>,
        replace?: boolean,
        ignoreBlock?: boolean,
        scrollToTop?: boolean,
        scrollRestoration?: boolean
      ) => {
        navigateRoute(
          to[ROUTE_METHODS],
          to[ROUTE_PARAMS],
          replace || false,
          ignoreBlock,
          to[ROUTE_HASH],
          scrollToTop,
          scrollRestoration
        );
      }
) as Navigate;

export default navigate;
