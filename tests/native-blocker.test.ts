// the env module must come first: it installs the native globals
import { pressBack, tick } from './_env/native.ts';
import assert from 'node:assert';
import test from 'node:test';

const { default: createRouter } =
  await import('../build-native/router/createRouter/index.js');
const { default: createPath } =
  await import('../build-native/router/createPath/index.js');
const { default: navigate } =
  await import('../build-native/router/navigate/index.js');
const { default: go } = await import('../build-native/router/go/index.js');
const { default: getValue } =
  await import('../build-native/core/getValue/index.js');
const { default: blocker } =
  await import('../build-native/router/navigationBlocker/index.js');

const router = createRouter({ home: createPath(), cart: createPath('cart') });

const settle = async () => {
  for (let i = 0; i < 4; i++) await tick();
};

await settle();

test('a parked back press says so at once, and allow() applies it', async () => {
  navigate(router.navigation.cart());

  await settle();

  const disable = blocker.enable();

  assert.equal(go(-1), true);

  await settle();

  assert.equal(
    getValue(blocker.isPendingNavigation),
    true,
    'the first press is what parks it - nothing else is coming to report it'
  );
  assert.equal(getValue(router.routes.cart), true, 'and nothing moved yet');

  blocker.isPendingNavigation.allow();

  await settle();

  assert.equal(getValue(router.routes.home), true, 'allow() applies the pop');
  assert.equal(getValue(blocker.isPendingNavigation), false);

  disable();
});

test('pressing back again while it is parked pops once, not twice', async () => {
  navigate(router.navigation.cart());

  await settle();

  const disable = blocker.enable();

  go(-1);

  await settle();

  go(-1);

  await settle();

  assert.equal(getValue(blocker.isPendingNavigation), true);

  blocker.isPendingNavigation.allow();

  await settle();

  assert.equal(getValue(router.routes.home), true);
  assert.equal(go(-1), false, 'one entry moved, not two');

  disable();
});

test('the hardware button is parked the same way, and deny() drops it', async () => {
  navigate(router.navigation.cart());

  await settle();

  const disable = blocker.enable();

  assert.equal(pressBack(), true, 'taken by the router, not by the OS');

  await settle();

  assert.equal(getValue(blocker.isPendingNavigation), true);

  blocker.isPendingNavigation.deny();

  await settle();

  assert.equal(getValue(router.routes.cart), true, 'dropped, so nothing moved');
  assert.equal(getValue(blocker.isPendingNavigation), false);

  disable();
});
