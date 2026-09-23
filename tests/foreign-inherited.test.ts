// the env module must come first: it installs the browser mocks
import {
  location,
  entries,
  current,
  history,
  session,
  tick,
  windowMock,
  addForeignEntry,
  TAB_KEY,
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

// what the tab kept from the document that built this history - a restored tab
// carries it over, and a reload never lost it
session[TAB_KEY] = '1';

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

assert.equal(
  session[TAB_KEY],
  '0',
  'and marked the tab, so a reload of it inherits the history as well'
);

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

// ---- and pages of its own change nothing: the history is still theirs ----
navigate(router.navigation.checkout());
await settle();

assert.deepEqual(
  urls(),
  ['/checkout', '/payment', '/payment', '/payment', '/checkout'],
  'the push landed on top of the strays, as a push does'
);

navigate(router.navigation.payment());
await settle();

addForeignEntry();
addForeignEntry();

const before = entries.length;

assert.equal(
  await repairHistory(),
  false,
  'a tab that opened on a history someone else built repairs none of it'
);

await settle();

assert.equal(entries.length, before, 'so it left them alone again');
assert.equal(location.pathname, '/payment', 'and stayed on the page');
assert.equal(getValue(router.routes.payment), true, 'and on the route');

console.log('foreign-inherited.test.ts: all assertions passed');
