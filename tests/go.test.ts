// the env module must come first: it installs the browser mocks
import { location, entries, tick } from './_env/browser.ts';
import assert from 'node:assert';
import test from 'node:test';

entries.length = 0;
entries.push({ url: '/a', state: { idx: 0 } });
location.pathname = '/a';
location.search = '';
location.hash = '';

const { default: createRouter } =
  await import('../build/router/createRouter/index.js');
const { default: createPath } =
  await import('../build/router/createPath/index.js');
const { default: navigate } = await import('../build/router/navigate/index.js');
const { default: go } = await import('../build/router/go/index.js');
const { default: getValue } = await import('../build/core/getValue/index.js');
const { default: blocker } =
  await import('../build/router/navigationBlocker/index.js');

const router = createRouter({ a: createPath('a'), b: createPath('b') });

const settle = async () => {
  for (let i = 0; i < 4; i++) await tick();
};

test('there is nothing to go back to on the entry the app started at', () => {
  assert.equal(go(-1), false);
  assert.equal(location.pathname, '/a', 'and nothing moved');

  assert.equal(go(0), false, 'and a move of nothing would reload the page');
});

test('a negative delta is the pop the back button makes', async () => {
  navigate(router.navigation.b());

  await settle();

  assert.equal(location.pathname, '/b');
  assert.equal(go(-1), true);

  await settle();

  assert.equal(location.pathname, '/a');
  assert.equal(getValue(router.routes.a), true);
  assert.equal(getValue(router.routes.b), false);
});

test('an enabled blocker parks it like any other navigation', async () => {
  navigate(router.navigation.b());

  await settle();

  const disable = blocker.enable();

  assert.equal(go(-1), true, 'it was asked for');

  await settle();

  assert.equal(getValue(blocker.isPendingNavigation), true);
  assert.equal(location.pathname, '/b', 'parked, so nothing moved yet');

  blocker.isPendingNavigation.allow();

  await settle();

  assert.equal(location.pathname, '/a');

  disable();
});
