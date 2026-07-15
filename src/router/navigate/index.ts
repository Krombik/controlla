import type { NavigationTarget } from '#router/types';
import {
  ROUTE_METHODS,
  ROUTE_PARAMS,
  ROUTE_HASH,
} from '#router/internal/constants';
import navigateRoute from '#router/internal/navigateRoute';

/**
 * Navigates to the given {@link to target}: pushes a history entry, or
 * replaces the current one with {@link replace}. The target's anchor, when
 * set, scrolls to its registered element after the navigation commits.
 * {@link ignoreBlock} bypasses an enabled `navigationBlocker`;
 * {@link scrollToTop} and {@link scrollRestoration} override the defaults
 * (both happen only on a new page otherwise).
 *
 * @example
 * ```ts
 * navigate(router.navigation.product({ id: '42' }));
 *
 * navigate(router.navigation.docs('usage'));         // with an anchor
 *
 * navigate(router.navigation.home(), true);          // replace
 * ```
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
    to[ROUTE_HASH],
    replace || false,
    ignoreBlock,
    scrollToTop,
    scrollRestoration
  );
};

export default navigate;
