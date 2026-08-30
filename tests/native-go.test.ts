// the env module must come first: it installs the native globals
import { tick } from './_env/native.ts';
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
const { default: $navigationState } =
  await import('../build-native/router/navigationState/index.js');

const router = createRouter({ home: createPath(), cart: createPath('cart') });

const settle = async () => {
  for (let i = 0; i < 4; i++) await tick();
};

await settle();

test('there is no back button on the device, so this is the whole of it', async () => {
  assert.equal(
    go(-1),
    false,
    'the launch entry has nothing behind it - the app would leave'
  );

  navigate(router.navigation.cart());

  await settle();

  assert.equal(getValue(router.routes.cart), true);
  assert.equal(go(-1), true);

  await settle();

  assert.equal(getValue(router.routes.home), true);
  assert.deepEqual(getValue($navigationState), { action: 'pop', delta: -1 });
  assert.equal(go(-1), false, 'and back to where it started');
});

test('forward is the same move the other way', async () => {
  assert.equal(go(1), true);

  await settle();

  assert.equal(getValue(router.routes.cart), true);
  assert.deepEqual(getValue($navigationState), { action: 'pop', delta: 1 });

  assert.equal(go(1), false, 'nothing was ever pushed past this one');
});

test('a move of nothing is not a move', () => {
  assert.equal(go(0), false);
});

test('a move further than the stack goes is refused whole', async () => {
  navigate(router.navigation.home());

  await settle();

  // home, cart, home - two entries back from the last is the first
  assert.equal(go(-3), false, 'no partial move to the nearest entry');
  assert.equal(go(-2), true);

  await settle();

  assert.equal(getValue(router.routes.home), true);
  assert.deepEqual(getValue($navigationState), { action: 'pop', delta: -2 });
});
