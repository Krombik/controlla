/** Browser mocks for router tests — must be imported before any lib module. */

import { setTimeout as sleep } from 'node:timers/promises';

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

export const history: any = {
  scrollRestoration: 'auto',
  get state() {
    return entries[idx].state;
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
  addEventListener(type: string, fn: Function) {
    (listeners[type] ||= []).push(fn);
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
  scroll(_x: number, _y: number) {},
  scrollTo() {},
};

defineGlobal('window', windowMock);

defineGlobal('document', {
  readyState: 'complete',
  documentElement: { scrollHeight: 2000 },
});

defineGlobal('requestAnimationFrame', (cb: () => void) => setTimeout(cb, 0));

defineGlobal('cancelAnimationFrame', (id: unknown) =>
  clearTimeout(id as number)
);

export const tick = () => sleep(0);
