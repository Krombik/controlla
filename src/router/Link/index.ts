import type { FC, MouseEvent, ReactNode } from 'react';

import useLink from '#router/useLink';
import type { NavigationTarget } from '#router/types';

export type LinkProps = {
  to: NavigationTarget<true>;
  onClick?(e: MouseEvent<HTMLAnchorElement, any>): void;
  /** Renders the anchor from the current {@link Link link} state. */
  render(
    href: string,
    onClick: (e: MouseEvent<HTMLAnchorElement, any>) => void,
    isMatched: boolean
  ): ReactNode;
  ignoreBlock?: boolean;
  scrollToTop?: boolean;
  scrollRestoration?: boolean;
};

/**
 * Render-prop link: subscribes to the target route and hands `href`,
 * `onClick` and `isMatched` to {@link LinkProps.render render} — a thin
 * wrapper over the `useLink` hook.
 *
 * @example
 * ```tsx
 * <Link
 *   to={navigationRoot.home()}
 *   render={(href, onClick, isMatched) => (
 *     <a href={href} onClick={onClick} className={isMatched ? 'active' : ''}>
 *       Home
 *     </a>
 *   )}
 * />
 * ```
 */
const Link: FC<LinkProps> = (props) => {
  const link = useLink(
    props.to,
    props.ignoreBlock,
    props.scrollToTop,
    props.scrollRestoration,
    props.onClick
  );

  return props.render(link.href, link.onClick, link.isMatched);
};

export default Link;
