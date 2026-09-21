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

assert.equal(await repairHistory(), true, 'and the app asks for it back');

await settle();

assert.equal(
  current(),
  entries[1],
  'it stepped back onto its own entry, and no further - below it lies another document, which a pop there would load'
);
assert.equal(location.pathname, '/payment', 'so the page stayed put');
assert.equal(getValue(router.routes.payment), true, 'and the route with it');
assert.equal(entries.length, 4, 'the strays are in front of it now');

// which is all the back button needed
history.go(-1);
await settle();

assert.equal(location.pathname, '/checkout', 'one press goes back');
assert.equal(getValue(router.routes.checkout), true, 'and routes');

// and the next push is what prunes them
navigate(router.navigation.payment());
await settle();

assert.deepEqual(urls(), ['/checkout', '/payment'], 'pruned by the push');
assert.equal(await repairHistory(), false, 'nothing left to drop');

// ---- with an entry of its own behind, it drops them outright ----
navigate(router.navigation.checkout());
await settle();

addForeignEntry();
addForeignEntry();

assert.equal(await repairHistory(), true, 'there was something to drop');

await settle();

assert.deepEqual(
  urls(),
  ['/checkout', '/payment', '/checkout'],
  'repaired in place'
);
assert.equal(history.length, 3, 'so the history counts right again');
assert.equal(location.pathname, '/checkout', 'without moving off the page');
assert.equal(getValue(router.routes.checkout), true, 'or off the route');

console.log('foreign-inherited.test.ts: all assertions passed');
