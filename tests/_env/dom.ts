/** Minimal browser mocks for non-router tests — import before any lib module. */

import { setTimeout as sleep } from 'node:timers/promises';

Object.assign(globalThis, {
  window: {
    queueMicrotask,
    addEventListener() {},
    removeEventListener() {},
  },
  document: {
    addEventListener() {},
    removeEventListener() {},
    hidden: false,
  },
});

export const tick = () => sleep(0);
