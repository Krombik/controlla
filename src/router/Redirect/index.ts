import { type FC, useEffect } from 'react';
import navigate from '#router/navigate';
import type { NavigationTarget } from '#router/types';

export type RedirectProps = {
  to: NavigationTarget<true>;
  push?: boolean;
};

const Redirect: FC<RedirectProps> = (props) => {
  useEffect(() => {
    navigate(props.to, !props.push, true);
  }, []);

  return null;
};

export default Redirect;
