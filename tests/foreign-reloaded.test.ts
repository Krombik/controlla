// the env module must come first: it installs the browser mocks
import {
  location,
  entries,
  history,
  session,
  tick,
  windowMock,
  addForeignEntry,
  setNavigationType,
  TAB_KEY,
} from './_env/browser.ts';
import assert from 'node:assert';

// A reload leaves the same history behind as a restore does, and the entry it
// lands on says as much - but a reload says so of itself, in every browser
// alike, so the tab keeps what it built.
entries.length = 0;
entries.push({ url: '/checkout', state: { idx: 0 } });
entries.push({ url: '/payment', state: { idx: 1 } });
location.pathname = '/payment';
location.search = '';
location.hash = '';

history.go(1);

// what the tab kept from the document that built this history
session[TAB_KEY] = '1';

setNavigationType('reload');

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

assert.equal(
  session[TAB_KEY],
  '1',
  'the tab is still the one that built it, and stays marked as such'
);

navigate(router.navigation.checkout());
await settle();

assert.deepEqual(urls(), ['/checkout', '/payment', '/checkout'], 'pushed');

// the payment widget navigates its iframe twice
addForeignEntry();
addForeignEntry();

assert.equal(await repairHistory(), true, 'there was something to drop');

await settle();

assert.deepEqual(urls(), ['/checkout', '/payment', '/checkout'], 'repaired');
assert.equal(history.length, 3, 'so the history counts right again');
assert.equal(location.pathname, '/checkout', 'without moving off the page');
assert.equal(getValue(router.routes.checkout), true, 'or off the route');

console.log('foreign-reloaded.test.ts: all assertions passed');
