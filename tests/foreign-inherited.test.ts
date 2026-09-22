// the env module must come first: it installs the browser mocks
import {
  location,
  entries,
  current,
  history,
  tick,
  windowMock,
  addForeignEntry,
} from './_env/browser.ts';
import assert from 'node:assert';

// A duplicated tab - or one that reloaded - stands on an entry a document that
// is gone left behind. The entries below it belong to that document too: going
// there is a page load, not a pop, so a repair must not reach for one.
entries.length = 0;
entries.push({ url: '/checkout', state: { idx: 0 } });
entries.push({ url: '/payment', state: { idx: 1 } });
location.pathname = '/payment';
location.search = '';
location.hash = '';

// standing on the last entry, the way a duplicate opens
history.go(1);

const { default: createRouter } =
  await import('../build/router/createRouter/index.js');
const { default: createPath } =
  await import('../build/router/createPath/index.js');
const { default: navigate } = await import('../build/router/navigate/index.js');
import getValue from '../build/core/getValue/index.js';
import repairHistory from '../build/router/repairHistory/index.js';

windowMock.onScroll = () => {};

const router = createRouter({
  checkout: createPath('checkout'),
  payment: createPath('payment'),
});

const settle = async () => {
  for (let i = 0; i < 4; i++) await tick();
};

const urls = () => entries.map((entry) => entry.url);

await settle();

assert.equal(getValue(router.routes.payment), true, 'booted where it stands');

// the payment widget navigates its iframe twice
addForeignEntry();
addForeignEntry();

assert.equal(history.length, 4, 'the history grew');

assert.equal(
  await repairHistory(),
  false,
  'nothing of its own to push from, so it answers instead of reaching'
);

await settle();

assert.equal(current(), entries[3], 'it did not move');
assert.equal(entries.length, 4, 'nor drop anything');
assert.equal(
  location.pathname,
  '/payment',
  'which is what keeps the page: a pop below the entry it opened on is a load, and the await would never end'
);
assert.equal(getValue(router.routes.payment), true, 'still on the route');

// ---- an entry it pushed itself is one it can pop to ----
navigate(router.navigation.checkout());
await settle();

assert.deepEqual(
  urls(),
  ['/checkout', '/payment', '/payment', '/payment', '/checkout'],
  'the push landed on top of the strays, as a push does'
);

addForeignEntry();
addForeignEntry();

assert.equal(await repairHistory(), true, 'there was something to drop');

await settle();

assert.deepEqual(
  urls(),
  ['/checkout', '/payment', '/payment', '/payment', '/checkout'],
  'repaired in place - the strays of this round are gone'
);
assert.equal(location.pathname, '/checkout', 'without moving off the page');
assert.equal(getValue(router.routes.checkout), true, 'or off the route');

console.log('foreign-inherited.test.ts: all assertions passed');
