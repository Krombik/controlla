import type { NavigationTarget } from '#router/types';

export type Navigate = {
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
  (
    to: NavigationTarget<true>,
    replace?: boolean,
    ignoreBlock?: boolean,
    scrollToTop?: boolean,
    scrollRestoration?: boolean
  ): void;
};
