import { type FC, useEffect } from 'react';
import type { RouteBase } from '../createRouter';
import navigate from '../navigate';

export type RedirectProps = {
  to: RouteBase<true>;
  push?: boolean;
};

const Redirect: FC<RedirectProps> = (props) => {
  useEffect(() => {
    navigate(props.to, !props.push);
  }, []);

  return null;
};

export default Redirect;
