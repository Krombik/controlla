// the env module must come first: it installs the native globals
import { emitUrl, setInitialUrl, tick } from './_env/native.ts';
import assert from 'node:assert';
import test from 'node:test';

const { default: createRouter } =
  await import('../build-native/router/createRouter/index.js');
const { default: createPath } =
  await import('../build-native/router/createPath/index.js');
const { default: param } =
  await import('../build-native/router/param/index.js');
const { default: withPrefixes } =
  await import('../build-native/router/withPrefixes/index.js');
const { default: getValue } =
  await import('../build-native/core/getValue/index.js');
const { default: selectParams } =
  await import('../build-native/router/selectParams/index.js');

// what a development launcher opens the app with: the app's own scheme, and a
// path that is none of the app's business
setInitialUrl('myapp://expo-development-client/?url=http://10.0.0.2:8081');

const router = createRouter(
  withPrefixes(['myapp:///', 'https://app.example.com'], {
    home: createPath(),
    product: createPath('product', param({ id: false })),
    cart: createPath('cart'),
  })
);

const settle = async () => {
  for (let i = 0; i < 4; i++) await tick();
};

await settle();

test('a launch url matching no prefix is an app opened from its icon', () => {
  assert.equal(getValue(router.routes.home), true);
  assert.equal(
    getValue(router.routes.product),
    false,
    'the launcher url is not a path of ours'
  );
});

test('a matching prefix is cut off, and what is left is the path', async () => {
  emitUrl('myapp:///product/42');

  await settle();

  assert.equal(getValue(router.routes.product), true);
  assert.deepEqual(getValue(selectParams(router.routes.product)), { id: '42' });
});

test('a host is part of the prefix, so an https link works the same', async () => {
  emitUrl('https://app.example.com/cart');

  await settle();

  assert.equal(getValue(router.routes.cart), true);
});

test('a url matching no prefix leaves the screen where it is', async () => {
  emitUrl('otherapp://product/9');

  await settle();

  assert.equal(getValue(router.routes.cart), true, 'nothing moved');
  assert.equal(getValue(router.routes.product), false);
});
