/** Browser mocks for router tests — must be imported before any lib module. */

import { setTimeout as sleep } from 'node:timers/promises';
import './flags.ts';

export { sleep };

export const defineGlobal = (name: string, value: unknown) => {
  (globalThis as Record<string, unknown>)[name] = value;
};

/** A minimal element standing in for a `registerAnchor` scroll target. */
export const fakeElement = (options?: {
  rect?: () => { top: number };
  onScroll?: (options?: ScrollIntoViewOptions) => void;
}) =>
  ({
    isConnected: true,
    scrollIntoView: options?.onScroll || (() => {}),
    getBoundingClientRect: options?.rect || (() => ({ top: 0 })),
  }) as unknown as HTMLElement;

export const listeners: Record<string, Function[]> = {};

export const location: any = {
  pathname: '/user/5/profile',
  search: '',
  hash: '',
};

const setLocation = (url: string) => {
  const u = new URL(url, 'http://t');
  location.pathname = u.pathname;
  location.search = u.search;
  location.hash = u.hash;
};

type Entry = { url: string; state: any };

export const entries: Entry[] = [{ url: '/user/5/profile', state: null }];

let idx = 0;

export const current = () => entries[idx];

/** Back to a single entry standing on it, as a freshly opened tab would be. */
export const resetEntries = (entry: Entry) => {
  entries.length = 0;
  entries.push(entry);
  idx = 0;
  setLocation(entry.url);
};

/**
 * What an iframe navigating does: appends an entry carrying the top document's
 * state and url, and stands on it. Only `history.length` shows it.
 */
export const addForeignEntry = () => {
  const entry = current();

  entries.splice(idx + 1, entries.length, {
    url: entry.url,
    state: entry.state,
  });

  idx++;
};

export const history: any = {
  scrollRestoration: 'auto',
  get state() {
    return entries[idx].state;
  },
  get length() {
    return entries.length;
  },
  pushState(state: any, _: string, url?: string) {
    entries.splice(idx + 1);
    entries.push({ url: url ?? entries[idx].url, state });
    idx++;
    if (url != null) setLocation(url);
  },
  replaceState(state: any, _: string, url?: string) {
    entries[idx] = { url: url ?? entries[idx].url, state };
    if (url != null) setLocation(url);
  },
  go(delta: number) {
    idx = Math.max(0, Math.min(entries.length - 1, idx + delta));
    setLocation(entries[idx].url);
    queueMicrotask(() => {
      for (const fn of listeners.popstate || [])
        fn({ state: entries[idx].state });
    });
  },
};

defineGlobal('location', location);

defineGlobal('history', history);

export const windowMock = {
  onscrollend: null,
  addEventListener(type: string, fn: Function) {
    const arr = (listeners[type] ||= []);

    // the real one ignores a listener it already has, which is what lets a
    // handler re-arm itself without stacking up
    if (!arr.includes(fn)) arr.push(fn);
  },
  removeEventListener(type: string, fn: Function) {
    const arr = listeners[type];
    if (arr) {
      const i = arr.indexOf(fn);
      if (i >= 0) arr.splice(i, 1);
    }
  },
  scrollX: 0,
  scrollY: 0,
  innerHeight: 800,
  /** Normalizes both call shapes the router uses into {@link onScroll}. */
  scroll(x: number | ScrollToOptions, y?: number) {
    if (typeof x == 'object') {
      windowMock.onScroll(x.left!, x.top!);
    } else {
      windowMock.onScroll(x, y!);
    }
  },
  onScroll(_x: number, _y: number) {},
  scrollTo() {},
};

defineGlobal('window', windowMock);

const documentElement = { scrollHeight: 2000 };

defineGlobal('document', { readyState: 'complete', documentElement });

const resizeCallbacks = new Set<() => void>();

/** The page changed size: notifies every live observer, as the browser would. */
export const triggerResize = () => {
  for (const cb of [...resizeCallbacks]) cb();
};

defineGlobal(
  'ResizeObserver',
  class {
    _cb: () => void;
    constructor(cb: () => void) {
      this._cb = cb;
    }
    observe() {
      resizeCallbacks.add(this._cb);
      // the real one delivers an initial observation for every observed element
      queueMicrotask(this._cb);
    }
    disconnect() {
      resizeCallbacks.delete(this._cb);
    }
  }
);

/** Lets a test make the page taller than the viewport, or shorter than it. */
export const setScrollHeight = (px: number) => {
  documentElement.scrollHeight = px;

  triggerResize();
};

/** The flat `x,y` pairs the router keeps, one per history entry. */
export const SCROLL_POS_HISTORY_KEY = 'controlla.SPH';

/** Where the page is right now, as `idx,x,y` - what a refresh restores. */
export const CURRENT_SCROLL_POS_KEY = 'controlla.CSP';

export const session: Record<string, string> = {};

defineGlobal('sessionStorage', {
  getItem: (key: string) => session[key] ?? null,
  setItem: (key: string, value: string) => {
    session[key] = value;
  },
  removeItem: (key: string) => {
    delete session[key];
  },
});

defineGlobal('requestAnimationFrame', (cb: () => void) => setTimeout(cb, 0));

defineGlobal('cancelAnimationFrame', (id: unknown) =>
  clearTimeout(id as number)
);

export const tick = () => sleep(0);
