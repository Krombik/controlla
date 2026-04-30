import { INTERNALS } from '#shared-internal/constants';
import type { ReadonlyControl } from '#types';

const load = (control: ReadonlyControl) => {
  let isCallable = true;

  const root = control[INTERNALS][INTERNALS];

  root._attach(undefined, undefined, true);

  return () => {
    if (isCallable) {
      isCallable = false;

      root._detach(undefined, undefined, true);
    }
  };
};

export default load;
