import { INTERNALS } from '#internal/constants';
import makePrimitiveInternals from '#internal/makePrimitiveInternals';
import noop from '#internal/noop';
import scheduleSet from '#internal/scheduleSet';
import { blocker } from '#router/internal/state';
import type { ReadonlyControl } from '#types';

const root = makePrimitiveInternals(false);

const beforeUnloadListener = (e: BeforeUnloadEvent) => {
  e.preventDefault();

  e.returnValue = true;
};

type NavigationBlocker = {
  /** Enables the blocker; returns `disable`. */
  enable(): () => void;
  disable(): void;
  /** Whether a navigation is parked awaiting `allow()`/`deny()`. */
  readonly isPendingNavigation: ReadonlyControl<boolean> & {
    allow(): void;
    deny(): void;
  };
};

/**
 * Blocks navigations while enabled (e.g. over an unsaved form): an attempted
 * navigation is parked instead of applied and `isPendingNavigation` becomes
 * `true`: `allow()` lets it proceed, `deny()` drops it. Closing the tab is
 * guarded via `beforeunload`.
 */
const navigationBlocker: NavigationBlocker = {
  enable() {
    blocker._canNavigate = false;

    window.addEventListener('beforeunload', beforeUnloadListener);

    return this.disable;
  },
  disable() {
    blocker._canNavigate = true;

    window.removeEventListener('beforeunload', beforeUnloadListener);
  },
  isPendingNavigation: {
    [INTERNALS]: root,
    allow() {
      scheduleSet(root, false, false);

      blocker._resume();

      blocker._resume = noop;
    },
    deny() {
      scheduleSet(root, false, false);

      blocker._resume = noop;
    },
  } as NavigationBlocker['isPendingNavigation'],
};

export default navigationBlocker;
