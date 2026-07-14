import type { NavigationTarget } from '#router/types';
import {
  ROUTE_METHODS,
  ROUTE_PARAMS,
  ROUTE_HASH,
} from '#router/internal/constants';
import navigateRoute from '#router/internal/navigateRoute';

/**
 * Navigates to the given {@link to target} (pushes a history entry; pass
 * {@link replace} to replace the current one). The target's hash, when set,
 * scrolls to the registered anchor after the navigation commits.
 */
const navigate = (
  to: NavigationTarget<true>,
  replace?: boolean,
  ignoreBlock?: boolean,
  scrollToTop?: boolean,
  scrollRestoration?: boolean
) => {
  navigateRoute(
    to[ROUTE_METHODS],
    to[ROUTE_PARAMS],
    replace,
    ignoreBlock,
    scrollToTop,
    scrollRestoration,
    to[ROUTE_HASH]
  );
};

export default navigate;
