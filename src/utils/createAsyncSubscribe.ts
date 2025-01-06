import noop from 'lodash.noop';
import type { ValueChangeCallbacks } from '../types';
import { postBatchCallbacksPush } from './batching';

export const createLoadableSubscribe =
  (set: ValueChangeCallbacks, load: () => () => void) => (cb: () => void) => {
    set.add(cb);

    const unload = load();

    return () => {
      set.delete(cb);

      unload();
    };
  };

export const createSubscribeWithError =
  (
    set: ValueChangeCallbacks,
    errorSet: ValueChangeCallbacks,
    load: () => () => void
  ) =>
  (cb: () => void) => {
    let isAvailable = true;

    const unload = load();

    const fn = () => {
      if (isAvailable) {
        isAvailable = false;

        postBatchCallbacksPush(() => {
          cb();

          isAvailable = true;
        });
      }
    };

    set.add(fn);

    errorSet.add(fn);

    return () => {
      set.delete(fn);

      errorSet.delete(fn);

      cb = noop;

      unload();
    };
  };
