import type { AsyncControlInternals } from '#internal/types';
import armPromise from '#internal/armPromise';
import { holdLoad } from '#internal/suspenseHolds';

const suspendOnControl = (root: AsyncControlInternals) => {
  if (root._load) {
    holdLoad(root);
  }

  return root._promise ? root._promise._promise : armPromise(root);
};

export default suspendOnControl;
