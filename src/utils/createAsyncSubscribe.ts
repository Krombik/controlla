import noop from 'lodash.noop';
import type { LoadableState, ValueChangeCallbacks } from '../types';
import { postBatchCallbacksPush } from './batching';

export const createLoadableSubscribe =
  (set: ValueChangeCallbacks, state: LoadableState) => (cb: () => void) => {
    set.add(cb);

    const unload = state.load();

    return () => {
      set.delete(cb);

      unload();
    };
  };

export const createSubscribeWithError =
  (
    set: ValueChangeCallbacks,
    errorSet: ValueChangeCallbacks,
    state: LoadableState
  ) =>
  (cb: () => void) => {
    let isAvailable = true;

    const unload = state._load ? state.load() : noop;

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
