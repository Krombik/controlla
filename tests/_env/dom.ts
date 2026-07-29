/** Minimal browser mocks for non-router tests — import before any lib module. */

import { setTimeout as sleep } from 'node:timers/promises';
import removeFromArray from '../../src/core/_internal/removeFromArray.ts';

const documentListeners = new Map<string, Array<() => void>>();

/** Errors the lib reported - without this mock its fallback kills the process. */
export const reportedErrors: unknown[] = [];

Object.assign(globalThis, {
  reportError(error: unknown) {
    reportedErrors.push(error);
  },
  window: {
    queueMicrotask,
    addEventListener() {},
    removeEventListener() {},
  },
  document: {
    addEventListener(type: string, listener: () => void) {
      const listeners = documentListeners.get(type);

      if (listeners) {
        listeners.push(listener);
      } else {
        documentListeners.set(type, [listener]);
      }
    },
    removeEventListener(type: string, listener: () => void) {
      const listeners = documentListeners.get(type);

      if (listeners) {
        removeFromArray(listeners, listener);
      }
    },
    hidden: false,
  },
});

/** Fires whatever the lib registered on `document`, e.g. `visibilitychange`. */
export const dispatchDocument = (type: string) => {
  const listeners = documentListeners.get(type);

  if (listeners) {
    for (const listener of listeners.slice()) {
      listener();
    }
  }

  return !!(listeners && listeners.length);
};

export const tick = () => sleep(0);
