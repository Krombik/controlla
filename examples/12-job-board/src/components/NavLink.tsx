/**
 * `Link` is headless - it hands you `href`, `onClick` and `isMatched` and lets
 * you render the anchor. Wrapping it once, as here, is the normal thing to do.
 *
 * `trackMatch` is what makes `isMatched` live: `true` tracks whether the route
 * is matched at all, `'exact'` also compares the params and anchor the link
 * points at. Without it nothing is subscribed and the link never re-renders.
 */

import Link from 'controlla/router/Link';
import type { NavigationTarget } from 'controlla/router/types';
import type { FC, ReactNode } from 'react';

type Props = {
  to: NavigationTarget;
  children: ReactNode;
  trackMatch?: true | 'exact';
};

const NavLink: FC<Props> = ({ to, children, trackMatch }) => (
  <Link
    to={to}
    trackMatch={trackMatch}
    render={({ href, onClick, isMatched }) => (
      <a
        href={href}
        onClick={onClick}
        aria-current={isMatched ? 'page' : undefined}
      >
        {children}
      </a>
    )}
  />
);

export default NavLink;
