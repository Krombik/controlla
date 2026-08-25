// the env module must come first: it installs the browser mocks
import {
  location,
  entries,
  history,
  tick,
  windowMock,
  addForeignEntry,
} from './_env/browser.ts';
import assert from 'node:assert';

// A third-party iframe - a 3DS payment frame, an ad - navigating appends an
// entry to the history. It is not ours: `location`, `history.state` and our
// index all stay put, and no popstate is fired. Only `history.length` shows it,
// and `history.go`, which counts it - so the back button does nothing for as
// many presses. Nothing prunes them, a push included, so the app has to ask.
entries.length = 0;
entries.push({ url: '/checkout', state: { idx: 0 } });
location.pathname = '/checkout';
location.search = '';
location.hash = '';

const { default: createRouter } =
  await import('../build/router/createRouter/index.js');
const { default: createPath } =
  await import('../build/router/createPath/index.js');
const { default: navigate } = await import('../build/router/navigate/index.js');
import getValue from '../build/core/getValue/index.js';
import navigationBlocker from '../build/router/navigationBlocker/index.js';
import repairHistory from '../build/router/repairHistory/index.js';

windowMock.onScroll = () => {};

const router = createRouter({
  checkout: createPath('checkout'),
  payment: createPath('payment'),
  confirmation: createPath('confirmation'),
});

const settle = async () => {
  for (let i = 0; i < 4; i++) await tick();
};

const urls = () => entries.map((entry) => entry.url);

const blocker = navigationBlocker;
const pending = blocker.isPendingNavigation;

await settle();

navigate(router.navigation.payment());
await settle();

assert.deepEqual(urls(), ['/checkout', '/payment'], 'on the payment page');

// the widget navigates its iframe twice
addForeignEntry();
addForeignEntry();

assert.equal(history.length, 4, 'the history grew');
assert.equal(location.pathname, '/payment', 'but the url did not');
assert.equal(getValue(router.routes.payment), true, 'nor the matched route');

// ---- the app asks, once whatever produced them is done ----
assert.equal(await repairHistory(), true, 'there was something to drop');
await settle();

assert.deepEqual(urls(), ['/checkout', '/payment'], 'repaired in place');
assert.equal(history.length, 2, 'so the history counts right again');
assert.equal(location.pathname, '/payment', 'without moving off the page');
assert.equal(getValue(router.routes.payment), true, 'or off the route');

assert.equal(await repairHistory(), false, 'nothing left to drop');

// one back press, no dead ones
history.go(-1);
await settle();

assert.equal(location.pathname, '/checkout', 'one press goes back');
assert.equal(getValue(router.routes.checkout), true, 'and routes');

history.go(1);
await settle();

// ---- a blocked pop has to travel the third party's entries as well ----
addForeignEntry();
addForeignEntry();

blocker.enable();

// what the user's third back press reaches: our own entry behind the two
history.go(-3);
await settle();

assert.equal(getValue(pending), true, 'blocked: the pop is pending');
assert.equal(
  location.pathname,
  '/payment',
  'blocked: undone across the iframe entries too, so we are where we were'
);

pending.allow();
await settle();

assert.equal(location.pathname, '/checkout', 'allow completes the pop');
assert.equal(getValue(router.routes.checkout), true, 'and routes');

console.log('foreign-entry.test.ts: all assertions passed');
