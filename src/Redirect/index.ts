import { type FC, useEffect } from 'react';
import navigate from '../navigate';
import { NavigationTarget } from '../types';

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
