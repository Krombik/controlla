// the env module must come first: it installs the native globals
import { tick } from './_env/native.ts';
import assert from 'node:assert';
import test from 'node:test';

const { default: createRouter } =
  await import('../build-native/router/createRouter/index.js');
const { default: createPath } =
  await import('../build-native/router/createPath/index.js');
const { default: withNotFound } =
  await import('../build-native/router/withNotFound/index.js');
const { default: NOT_FOUND } =
  await import('../build-native/router/NOT_FOUND/index.js');
const { default: getValue } =
  await import('../build-native/core/getValue/index.js');
const { default: $routerReady } =
  await import('../build-native/router/routerReady/index.js');

// nothing set an initial url, which is what `Linking` answers with for an app
// opened from its icon
const router = createRouter(
  withNotFound({ home: createPath(), cart: createPath('cart') })
);

for (let i = 0; i < 4; i++) await tick();

test('an app opened with no url lands on the root route, not on not-found', () => {
  assert.equal(getValue($routerReady), true);
  assert.equal(getValue(router.routes.home), true);
  assert.equal(getValue((router.routes as any)[NOT_FOUND]), false);
});
