import type { ReactNode } from 'react';

import type { LinkClickEvent } from '#router/internal/types';
import type { NavigationTarget } from '#router/types';

export type { LinkClickEvent };

export type LinkOptions = {
  /** The navigation target. */
  to: NavigationTarget<true>;
  /** Runs before the navigation, with the click that caused it. */
  onClick?(e: LinkClickEvent): void;
  /**
   * Computes {@link LinkHandle.isMatched isMatched}, subscribing to changes:
   * `true` whether the target route is matched; `'exact'` whether it's
   * matched with exactly the params and anchor this link navigates to. Read
   * once - whether a link tracks isn't something that can change.
   */
  trackMatch?: boolean | 'exact';
  /** Bypasses an enabled `navigationBlocker`. */
  ignoreBlock?: boolean;
  /** Scrolls to the top after the navigation (default: only on a new page). */
  scrollToTop?: boolean;
  /** Saves the scroll position for the back navigation (default: only on a new page). */
  scrollRestoration?: boolean;
};

export type LinkHandle = {
  /** The current href of the target route. */
  href: string;
  /**
   * Click handler performing the navigation: it respects modifier keys,
   * `target` and `event.preventDefault()`.
   */
  onClick(e: LinkClickEvent): void;
  /**
   * Whether the target route is currently matched (exactly, with
   * {@link LinkOptions.trackMatch trackMatch}: `'exact'`); always `false` when {@link LinkOptions.trackMatch trackMatch} isn't set.
   */
  isMatched: boolean;
};

export type UseLink = {
  /**
   * Headless link primitive: subscribes to the target route's state and
   * returns everything needed to render an anchor: use it to build your own
   * `Link`.
   *
   * @example
   * ```tsx
   * const { href, onClick, isMatched } = useLink({ to: navigationRoot.home() });
   *
   * return <a href={href} onClick={onClick} className={isMatched ? 'active' : ''} />;
   * ```
   */
  (options: LinkOptions): LinkHandle;
};

export type LinkProps = LinkOptions & {
  /** Renders the anchor from the current link state. */
  render(props: LinkHandle): ReactNode;
};

export type LinkComponent = {
  /**
   * Render-prop link: subscribes to the target route and hands `href`,
   * `onClick` and `isMatched` to {@link LinkProps.render render}: a thin
   * wrapper over the `useLink` hook. `isMatched` is computed (and subscribed)
   * only with the `trackMatch` option.
   *
   * @example
   * ```tsx
   * <Link
   *   to={navigationRoot.home()}
   *   trackMatch
   *   render={({ href, onClick, isMatched }) => (
   *     <a href={href} onClick={onClick} className={isMatched ? 'active' : ''}>
   *       Home
   *     </a>
   *   )}
   * />
   * ```
   */
  (props: LinkProps): ReactNode;
};
