import { Router } from '../createRouter';
import { BLOCK_ROUTER } from '../utils/constants';

const blockRouter = (router: Router, message: string | (() => string)) =>
  router[BLOCK_ROUTER](message);

export default blockRouter;
