// the env module must come first: it installs the browser mocks
import {
  location,
  entries,
  history,
  tick,
  sleep,
  windowMock,
  listeners,
  setScrollHeight,
  defineGlobal,
  session,
  SCROLL_POS_HISTORY_KEY,
  CURRENT_SCROLL_POS_KEY,
} from './_env/browser.ts';
import assert from 'node:assert';

// a refresh: the scroll listener left the position of the entry being opened
entries.length = 0;
entries.push({ url: '/a', state: { idx: 0 } });
location.pathname = '/a';
location.search = '';
location.hash = '';
session[CURRENT_SCROLL_POS_KEY] = '0,0,250';

const { default: createRouter } =
  await import('../build/router/createRouter/index.js');
const { default: createPath } =
  await import('../build/router/createPath/index.js');
const { default: navigate } = await import('../build/router/navigate/index.js');

const scrolls: Array<[number, number]> = [];

windowMock.onScroll = (x: number, y: number) => {
  scrolls.push([x, y]);
};

const router = createRouter({
  a: createPath('a'),
  b: createPath('b'),
  c: createPath('c'),
});

const settle = async () => {
  for (let i = 0; i < 4; i++) await tick();
};

const storedScrolls = () => session[SCROLL_POS_HISTORY_KEY];

await settle();

assert.deepEqual(
  scrolls[0],
  [0, 250],
  'refresh restores the position saved for this entry'
);

// a marked navigation records where it is leaving, and only that - the entry
// being opened has no position yet
windowMock.scrollY = 400;
navigate(router.navigation.b());
await settle();

assert.equal(storedScrolls(), '0,400', 'leaving an entry records it');

windowMock.scrollY = 900;
navigate(router.navigation.c());
await settle();

assert.equal(storedScrolls(), '0,400,0,900', 'each entry records its own');

// back to /b: it has a position, so this run of entries tracks scroll and the
// one being left joins it
windowMock.scrollY = 1500;
history.go(-1);
await settle();

assert.equal(location.pathname, '/b', 'popped back to /b');
assert.deepEqual(scrolls.at(-1), [0, 900], "/b's own position was restored");
assert.equal(
  storedScrolls(),
  '0,400,0,900,0,1500',
  'the entry the pop left behind keeps its position for the way forward'
);

// no unload event is reliable, so the current position is kept up to date from
// the scroll event instead
for (const fn of listeners.scroll || []) fn();

await sleep(150);

assert.equal(
  session[CURRENT_SCROLL_POS_KEY],
  '1,0,1500',
  'scrolling stamps the position against the entry it belongs to'
);

// A pop restores before the target page has swapped in, so the position is just
// as unreachable as on a refresh and needs the same waiting-for-content retry.
let roCallback: (() => void) | undefined;

defineGlobal(
  'ResizeObserver',
  class {
    constructor(cb: () => void) {
      roCallback = cb;
    }
    observe() {}
    disconnect() {
      roCallback = undefined;
    }
  }
);

navigate(router.navigation.c());
await settle();

windowMock.scrollY = 700;
navigate(router.navigation.a());
await settle();

setScrollHeight(600);
scrolls.length = 0;
history.go(-1);
await settle();

assert.equal(location.pathname, '/c', 'popped back to /c');
assert.equal(
  scrolls.length,
  0,
  'pop: not scrolled while the page is too short'
);
assert.ok(roCallback, 'pop: growth observer active');

setScrollHeight(2000);
roCallback!();

assert.deepEqual(
  scrolls.at(-1),
  [0, 700],
  'pop: restored once the content arrived'
);

console.log('scroll.test.ts: all assertions passed');
