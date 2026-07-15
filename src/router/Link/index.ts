import type { FC, ReactNode } from 'react';

import useLink, { type LinkHandle, type LinkOptions } from '#router/useLink';

export type LinkProps = LinkOptions & {
  /** Renders the anchor from the current link state. */
  render(props: LinkHandle): ReactNode;
};

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
const Link: FC<LinkProps> = (props) => props.render(useLink(props));

export default Link;
