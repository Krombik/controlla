import type { Router } from '../createRouter';
import { UNBLOCK_ROUTER } from '../utils/constants';

const unblockRouter = (router: Router) => {
  router[UNBLOCK_ROUTER]();
};

export default unblockRouter;
