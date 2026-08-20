import type { AsyncControlInternals, ChangeListener } from '#internal/types';
import { INTERNALS } from '#internal/constants';
import { addListener, removeListener } from '#internal/flushQueue';

/**
 * The loads suspended renders started. A suspension is not a mount - React runs
 * no cleanup for a render it throws away - so nothing but this knows about
 * them: the hold goes to whichever consumer commits first, and to the end of
 * the loading if none ever does.
 */
const held = new Map<AsyncControlInternals, ChangeListener>();

/** One hold per root, however many components suspend on it. */
export const holdLoad = (root: AsyncControlInternals) => {
  if (!held.has(root)) {
    const listener: ChangeListener = (isLoading) => {
      if (!isLoading) {
        releaseLoad(root);
      }
    };

    held.set(root, listener);

    // before the load is started, so a loader answering within it is still seen
    addListener(root._loadingControl[INTERNALS], listener);

    root._attach(undefined, undefined, true);
  }
};

export const releaseLoad = (root: AsyncControlInternals) => {
  const listener = held.get(root);

  if (listener) {
    held.delete(root);

    removeListener(root._loadingControl[INTERNALS], listener);

    root._detach(undefined, undefined, true);
  }
};
