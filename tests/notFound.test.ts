// the env module must come first: it installs the browser mocks
import { location, entries, tick } from './_env/browser.ts';
import assert from 'node:assert';
import test from 'node:test';

// Nothing here declares a catch-all: `createRouter` puts one on the root, so a
// url none of the paths describe still matches something and the boot has
// nothing to throw over
entries.length = 0;
entries.push({ url: '/nowhere/at/all', state: { idx: 0 } });
location.pathname = '/nowhere/at/all';
location.search = '';
location.hash = '';

const { default: createRouter } =
  await import('../build/router/createRouter/index.js');
const { default: createPath } =
  await import('../build/router/createPath/index.js');
const { default: navigate } = await import('../build/router/navigate/index.js');
const { default: NOT_FOUND } =
  await import('../build/router/NOT_FOUND/index.js');
const { default: withNotFound } =
  await import('../build/router/withNotFound/index.js');
const { default: getValue } = await import('../build/core/getValue/index.js');
const { default: selectParams } =
  await import('../build/router/selectParams/index.js');

const router: any = createRouter({
  home: createPath(),
  user: createPath('user'),
  // a section with a catch-all of its own, which is what `withNotFound` is for
  // now that the root has one already
  docs: createPath('docs', withNotFound({ intro: createPath('intro') })),
});

test('an undeclared url matches the root catch-all', () => {
  assert.equal(getValue(router.routes[NOT_FOUND]), true);
  assert.equal(getValue(router.routes.home), false);
  assert.equal(getValue(router.routes.user), false);
  assert.deepEqual(getValue(selectParams(router.routes[NOT_FOUND])), {
    notFoundPath: 'nowhere/at/all',
  });
});

test('a declared url still wins over it', async () => {
  navigate(router.navigation.user());

  await tick();

  assert.equal(getValue(router.routes.user), true);
  assert.equal(getValue(router.routes[NOT_FOUND]), false);
});

test('and navigating away from one lands back on it', async () => {
  navigate(router.navigation[NOT_FOUND]({ notFoundPath: 'gone' }));

  await tick();

  assert.equal(getValue(router.routes[NOT_FOUND]), true);
  assert.equal(location.pathname, '/gone');
});

test('a nested catch-all answers for its branch', async () => {
  navigate(router.navigation.docs()[NOT_FOUND]({ notFoundPath: 'missing' }));

  await tick();

  assert.equal(location.pathname, '/docs/missing');
  assert.equal(getValue(router.routes.docs[NOT_FOUND]), true);
  assert.equal(getValue(router.routes.docs.intro), false);
  assert.equal(
    getValue(router.routes[NOT_FOUND]),
    false,
    'the root one never sees it'
  );
  assert.deepEqual(getValue(selectParams(router.routes.docs[NOT_FOUND])), {
    notFoundPath: 'missing',
  });
});

test('a declared child still wins inside that branch', async () => {
  navigate(router.navigation.docs().intro());

  await tick();

  assert.equal(getValue(router.routes.docs.intro), true);
  assert.equal(getValue(router.routes.docs[NOT_FOUND]), false);
});
