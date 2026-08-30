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

/** Drops whatever is parked, without letting it through. */
const release = () => {
  scheduleSet(root, false, false);

  blocker._resume = noop;
};

/**
 * Blocks navigations while enabled (e.g. over an unsaved form): an attempted
 * navigation is parked instead of applied and `isPendingNavigation` becomes
 * `true`: `allow()` lets it proceed, `deny()` drops it. On the web, closing
 * the tab is guarded via `beforeunload`.
 */
const navigationBlocker: NavigationBlocker = {
  enable() {
    blocker._canNavigate = false;

    if (!__NATIVE__) {
      window.addEventListener('beforeunload', beforeUnloadListener);
    }

    return this.disable;
  },
  disable() {
    blocker._canNavigate = true;

    if (!__NATIVE__) {
      window.removeEventListener('beforeunload', beforeUnloadListener);
    }

    // what is parked was parked by this guard, and the guard is going -
    // allowing it later would take the app off wherever it has moved to since
    release();
  },
  isPendingNavigation: {
    [INTERNALS]: root,
    allow() {
      scheduleSet(root, false, false);

      blocker._resume();

      blocker._resume = noop;
    },
    deny: release,
  } as NavigationBlocker['isPendingNavigation'],
};

export default navigationBlocker;
