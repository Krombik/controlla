// the env module must come first: it installs the native globals
import {
  countListeners,
  emitUrl,
  pressBack,
  setInitialUrl,
  tick,
} from './_env/native.ts';
import assert from 'node:assert';
import test from 'node:test';

const { default: createRouter } =
  await import('../build-native/router/createRouter/index.js');
const { default: createPath } =
  await import('../build-native/router/createPath/index.js');
const { default: param } =
  await import('../build-native/router/param/index.js');
const { default: query } =
  await import('../build-native/router/query/index.js');
const { default: getValue } =
  await import('../build-native/core/getValue/index.js');
const { default: selectParams } =
  await import('../build-native/router/selectParams/index.js');
const { default: navigate } =
  await import('../build-native/router/navigate/index.js');
const { default: $navigationState } =
  await import('../build-native/router/navigationState/index.js');
const { default: $routerReady } =
  await import('../build-native/router/routerReady/index.js');

const paths = {
  // no path matches '/', which on the web would be a boot error - here the
  // launch url is what the first match is made against
  product: createPath(
    'product',
    param({ id: false }),
    // an `initialValue` lands on the first load of the session and nothing
    // after it; a `defaultValue` lands on every absent one
    query({
      tab: { optional: true, initialValue: 'specs' },
      view: { optional: true, defaultValue: 'grid' },
    })
  ),
  cart: createPath('cart'),
};

setInitialUrl('myapp://product/42?tab=reviews');

const router = createRouter(paths);

// read straight after the call: `Linking` answers on a microtask, so by the
// time any test body runs the launch url has already landed
const beforeTheUrl = {
  _ready: getValue($routerReady),
  _matched: getValue(router.routes.product),
};

const settle = async () => {
  for (let i = 0; i < 4; i++) await tick();
};

await settle();

test('nothing is matched until the launch url lands', () => {
  assert.equal(
    beforeTheUrl._ready,
    undefined,
    'the shell has nothing to render with yet'
  );
  assert.equal(
    beforeTheUrl._matched,
    false,
    'and no route is matched, so a view renders nothing'
  );

  assert.equal(getValue($routerReady), true);
  assert.equal(
    getValue(router.routes.product),
    true,
    'the launch url is what it matched - never a placeholder'
  );
  assert.deepEqual(getValue(selectParams(router.routes.product)), {
    id: '42',
    tab: 'reviews',
    view: 'grid',
  });
});

test('the launch url replaces the entry rather than pushing onto it', () => {
  // nothing was navigated: the app simply started there
  assert.deepEqual(getValue($navigationState), { action: 'none', delta: 0 });

  // and there is nothing behind it for the OS back button to reach
  assert.equal(pressBack(), false, 'so back leaves the app');
});

test('navigating pushes, and the back button pops it', async () => {
  navigate(router.navigation.cart());

  await settle();

  assert.equal(getValue(router.routes.cart), true);
  assert.deepEqual(getValue($navigationState), { action: 'push', delta: 1 });

  assert.equal(pressBack(), true, 'the router took the back press');

  await settle();

  assert.equal(getValue(router.routes.product), true);
  assert.deepEqual(getValue(selectParams(router.routes.product)), {
    id: '42',
    tab: 'reviews',
    view: 'grid',
  });
  assert.deepEqual(getValue($navigationState), { action: 'pop', delta: -1 });

  assert.equal(pressBack(), false, 'and the stack is back to its first entry');
});

test('a url arriving while the app runs is a push', async () => {
  emitUrl('myapp://product/7');

  await settle();

  assert.deepEqual(
    getValue(selectParams(router.routes.product)),
    { id: '7', tab: undefined, view: 'grid' },
    'a later url is not the first load, so no initialValue is applied'
  );
  assert.deepEqual(getValue($navigationState), { action: 'push', delta: 1 });

  assert.equal(pressBack(), true);

  await settle();

  assert.deepEqual(
    getValue(selectParams(router.routes.product)),
    { id: '42', tab: 'reviews', view: 'grid' },
    'and it went back onto what was showing'
  );
});

test('a trailing slash is dropped the way the web boot drops it', async () => {
  emitUrl('myapp://cart/');

  await settle();

  assert.equal(getValue(router.routes.cart), true);

  pressBack();

  await settle();
});

test('the router subscribed to the OS once, and only once', () => {
  const counts = countListeners();

  assert.equal(counts.url, 1);
  assert.equal(counts.back, 1);
});
