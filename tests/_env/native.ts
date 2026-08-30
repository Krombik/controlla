/** The React Native environment, installed before any lib module reads it. */

import { setTimeout as sleep } from 'node:timers/promises';

export * from './reactNative.ts';

const globals: Record<string, unknown> = {
  // `__NATIVE__` is substituted in the native build, so nothing sets it here
  requestAnimationFrame: (cb: () => void) => setTimeout(cb, 0),
  cancelAnimationFrame: (id: unknown) => clearTimeout(id as any),
  // what the runtime installs, and what `reportError` reaches for there
  ErrorUtils: {
    reportError(error: unknown) {
      reportedErrors.push(error);
    },
  },
};

/** Errors the lib reported - without this its fallback kills the process. */
export const reportedErrors: unknown[] = [];

for (let i = 0, keys = Object.keys(globals); i < keys.length; i++) {
  (globalThis as Record<string, unknown>)[keys[i]] = globals[keys[i]];
}

export const tick = () => sleep(0);
