import { type FC, useEffect } from 'react';
import navigate from '#router/navigate';
import type { NavigationTarget } from '#router/types';

export type RedirectProps = {
  /** The navigation target. */
  to: NavigationTarget<true>;
  /** Push a history entry instead of replacing the current one. */
  push?: boolean;
};

/**
 * Navigates to {@link RedirectProps.to} on mount (replacing the history
 * entry unless `push` is set); render it as a route's page to redirect.
 */
const Redirect: FC<RedirectProps> = (props) => {
  useEffect(() => {
    navigate(props.to, !props.push, true);
  }, []);

  return null;
};

export default Redirect;
