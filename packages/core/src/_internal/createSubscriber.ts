import type { AsyncRootNode, ChangeListener } from '#internal/types';
import noop from 'lodash.noop';
import { getCurrentLane } from './flushQueue';

const addUniqueListener = (
  indexMap: Map<ChangeListener, number>,
  callbacks: ChangeListener[],
  cb: ChangeListener
) => {
  if (!indexMap.has(cb)) {
    indexMap.set(cb, callbacks.length);

    callbacks.push(cb);
  }
};

const removeListener = (
  indexMap: Map<ChangeListener, number>,
  callbacks: ChangeListener[],
  cb: ChangeListener
) => {
  if (indexMap.has(cb)) {
    const last = callbacks.pop()!;

    if (last != cb) {
      const index = indexMap.get(cb)!;

      callbacks[index] = last;

      indexMap.set(last, index)!;
    }

    indexMap.delete(cb);
  }
};

const createSubscriber = (
  callbacks: ChangeListener[],
  control?: Pick<AsyncRootNode, '_attachLoad'>
) => {
  const indexMap = new Map<ChangeListener, number>();

  return (cb: ChangeListener, withoutLoad?: boolean) => {
    const unload = withoutLoad || !control ? noop : control._attachLoad();

    const currentLane = getCurrentLane();

    if (currentLane) {
      currentLane._afterFlushHooks.push(() => {
        addUniqueListener(indexMap, callbacks, cb);
      });
    } else {
      addUniqueListener(indexMap, callbacks, cb);
    }

    return () => {
      unload();

      const currentLane = getCurrentLane();

      if (currentLane) {
        currentLane._afterFlushHooks.push(() => {
          removeListener(indexMap, callbacks, cb);
        });
      } else {
        removeListener(indexMap, callbacks, cb);
      }
    };
  };
};

export default createSubscriber;
