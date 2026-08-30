import type { NavigationTarget } from '#router/types';

export type Navigate = {
  /**
   * Navigates to the given {@link to target}: pushes an entry onto the
   * router's stack, or replaces the current one with {@link replace}.
   * {@link ignoreBlock} bypasses an enabled `navigationBlocker`.
   *
   * @example
   * ```ts
   * navigate(router.navigation.product({ id: '42' }));
   *
   * navigate(router.navigation.home(), true);          // replace
   * ```
   */
  (to: NavigationTarget<true>, replace?: boolean, ignoreBlock?: boolean): void;
};
