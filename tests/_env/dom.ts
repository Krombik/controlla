/** The real DOM every non-router test runs on - import before any lib module. */

import { setTimeout as sleep } from 'node:timers/promises';
import { win } from './happyDom.ts';

export { reportedErrors } from './happyDom.ts';

/** Fires a document event the lib listens for, e.g. `visibilitychange`. */
export const dispatchDocument = (type: string) => {
  win.document.dispatchEvent(new win.Event(type));
};

export const tick = () => sleep(0);
