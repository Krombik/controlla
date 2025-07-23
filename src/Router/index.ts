import { type FC } from 'react';

type Props = {
  router: import('../createRouter').Router<{}>;
};

const Router: FC<Props> = (props) => props.router._render();

export default Router;
