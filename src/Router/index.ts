import type { FC } from 'react';
import { ROUTER } from '../utils/constants';

type Props = {
  router: import('../createRouter').Router;
};

const Router: FC<Props> = (props) => props.router[ROUTER]();

export default Router;
