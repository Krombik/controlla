// the env module must come first: it installs the browser mocks
import {
  location,
  entries,
  history,
  tick,
  windowMock,
  listeners,
} from './_env/browser.ts';
import assert from 'node:assert';

// a refresh: the unload stamped a scroll marker on the entry we are opening
entries.length = 0;
entries.push({ url: '/a', state: { idx: 0, init: 1, scroll: [0, 250] } });
location.pathname = '/a';
location.search = '';
location.hash = '';

const { default: createRouter } =
  await import('../build/router/createRouter/index.js');
const { default: createPath } =
  await import('../build/router/createPath/index.js');
const { default: navigate } = await import('../build/router/navigate/index.js');

const scrolls: Array<[number, number]> = [];

windowMock.scroll = (x: number, y: number) => {
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

const stateOf = (i: number) => entries[i].state;

await settle();

// `scroll` means "restore this on the way back", so the entry being viewed
// must never hold one - it has already been consumed
assert.deepEqual(
  scrolls[0],
  [0, 250],
  'refresh restores the scroll the unload saved'
);
assert.equal(
  'scroll' in stateOf(0) ? stateOf(0).scroll : undefined,
  undefined,
  'refresh drops the marker once restored'
);

windowMock.scrollY = 400;
navigate(router.navigation.b());
await settle();

assert.deepEqual(
  stateOf(0).scroll,
  [0, 400],
  'leaving an entry for a new page marks it'
);
assert.equal(
  stateOf(1).scroll,
  undefined,
  'the entry being opened must not inherit the marker'
);

windowMock.scrollY = 900;
navigate(router.navigation.c());
await settle();

assert.deepEqual(
  stateOf(1).scroll,
  [0, 900],
  'each entry marks its own scroll'
);
assert.equal(stateOf(2).scroll, undefined, 'still no marker on the new entry');

// back to /b: its marker is consumed and cleared
history.go(-1);
await settle();

assert.equal(location.pathname, '/b', 'popped back to /b');
assert.deepEqual(scrolls.at(-1), [0, 900], "/b's own scroll was restored");
assert.equal(
  stateOf(1).scroll,
  undefined,
  'a consumed marker is cleared from the entry now being viewed'
);

// An unload marks the current entry so a refresh can restore it - but the
// blocker cancels unloads, so the marker can outlive the attempt and sit on the
// entry still being viewed. A push from there must not carry it over.
windowMock.scrollY = 1200;
router.navigationBlocker.enable();

for (const fn of listeners.beforeunload || []) {
  fn({ preventDefault() {}, returnValue: false });
}
await settle();

assert.deepEqual(
  stateOf(1).scroll,
  [0, 1200],
  'a cancelled unload leaves its marker behind'
);

router.navigationBlocker.disable();
navigate(router.navigation.c());
await settle();

assert.equal(
  stateOf(2).scroll,
  undefined,
  'a push must not inherit a marker left by a cancelled unload'
);

console.log('scroll.test.ts: all assertions passed');
