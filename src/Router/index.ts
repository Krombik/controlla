import type { FC } from 'react';
import type { Router } from '../createRouter';
import { ROUTER } from '../utils/constants';

type Props = {
  router: Router;
};

const Router: FC<Props> = (props) => props.router[ROUTER]();

export default Router;
