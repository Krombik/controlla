// the env module must come first: it installs the browser mocks
import {
  location,
  entries,
  history,
  tick,
  windowMock,
} from './_env/browser.ts';
import assert from 'node:assert';

// the back target carries a stamped idx and a saved scroll, so the blocker has
// to interleave with the scroll-save round trip rather than replace it
entries.length = 0;
entries.push({ url: '/a', state: { idx: 0, scroll: [0, 250] } });
location.pathname = '/a';
location.search = '';
location.hash = '';

const { default: createRouter } =
  await import('../build/router/createRouter/index.js');
const { default: createPath } =
  await import('../build/router/createPath/index.js');
const { default: navigate } = await import('../build/router/navigate/index.js');
import getValue from '../build/core/getValue/index.js';

const router = createRouter({ a: createPath('a'), b: createPath('b') });
const blocker = router.navigationBlocker;
const pending = blocker.isPendingNavigation;

const settle = async () => {
  for (let i = 0; i < 4; i++) await tick();
};

// ---- user navigation, denied ----
{
  blocker.enable();
  navigate(router.navigation.b());
  await settle();

  assert.equal(getValue(pending), true, 'nav: blocked navigation is pending');
  assert.equal(location.pathname, '/a', 'nav: url must not move while pending');

  pending.deny();
  await settle();

  assert.equal(getValue(pending), false, 'nav: deny clears pending');
  assert.equal(location.pathname, '/a', 'nav: deny keeps the current url');
  assert.equal(entries.length, 1, 'nav: deny adds no history entry');
}

// ---- user navigation, allowed ----
{
  navigate(router.navigation.b());
  await settle();

  assert.equal(getValue(pending), true, 'nav: second attempt blocks again');

  pending.allow();
  await settle();

  assert.equal(getValue(pending), false, 'nav: allow clears pending');
  assert.equal(location.pathname, '/b', 'nav: allow completes the navigation');
  assert.equal(getValue(router.routes.b), true, 'nav: allow routes');
  assert.equal(entries[1].state.idx, 1, 'nav: the pushed entry is stamped');
}

// ---- pop, denied ----
{
  windowMock.scrollY = 700;
  history.go(-1);
  await settle();

  assert.equal(getValue(pending), true, 'pop: blocked pop is pending');
  assert.equal(location.pathname, '/b', 'pop: the pop is undone while pending');

  pending.deny();
  await settle();

  assert.equal(location.pathname, '/b', 'pop: deny stays put');
  assert.equal(entries[1].state.idx, 1, 'pop: deny leaves the entry stamped');
}

// ---- pop, allowed ----
{
  history.go(-1);
  await settle();

  assert.equal(getValue(pending), true, 'pop: blocks again after a deny');

  pending.allow();
  await settle();

  assert.equal(location.pathname, '/a', 'pop: allow completes the pop');
  assert.equal(getValue(router.routes.a), true, 'pop: allow routes');

  // the entry being left must keep its OWN idx - stamping the target's onto it
  // makes every later visit to it a silent no-op
  assert.equal(
    entries[1].state.idx,
    1,
    'pop: the entry left behind keeps its own idx'
  );
  assert.deepEqual(
    entries[1].state.scroll,
    [0, 700],
    "pop: allow still saves the left entry's scroll"
  );
}

// ---- and the entry survives a later visit ----
{
  blocker.disable();
  history.go(1);
  await settle();

  assert.equal(location.pathname, '/b', 'forward moves the url');
  assert.equal(getValue(router.routes.b), true, 'forward actually routes');
}

console.log('blocker.test.ts: all assertions passed');
