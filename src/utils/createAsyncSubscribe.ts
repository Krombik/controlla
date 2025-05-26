import noop from 'lodash.noop';
import type { InternalAsyncState, ValueChangeCallbacks } from '../types';
import { postBatchCallbacksPush } from './batching';
import load from '../load';

export const createLoadableSubscribe =
  (set: ValueChangeCallbacks, state: InternalAsyncState) =>
  (cb: () => void) => {
    set.add(cb);

    const unload = load(state);

    return () => {
      set.delete(cb);

      unload();
    };
  };

export const createSubscribeWithError =
  (
    set: ValueChangeCallbacks,
    errorSet: ValueChangeCallbacks,
    state: InternalAsyncState
  ) =>
  (cb: () => void) => {
    let isAvailable = true;

    const unload = state._load ? load(state) : noop;

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
