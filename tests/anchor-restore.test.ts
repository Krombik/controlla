// the env module must come first: it installs the browser mocks
import { location, entries, tick, fakeElement } from './_env/browser.ts';
import assert from 'node:assert';

// A refresh of a url that carries a hash, from a position the user had scrolled
// back to. The saved marker is `[0, 0]`, which is the whole point: restoring it
// moves nothing and so fires no scroll event, and a scroll event is what
// normally cancels the anchor's pending scroll. Without an explicit cancel the
// page jumps to the hash instead of staying where it was left.
entries.length = 0;
entries.push({
  url: '/docs#deployment',
  state: { idx: 0, init: 1, scroll: [0, 0] },
});
location.pathname = '/docs';
location.search = '';
location.hash = '#deployment';

const { default: createRouter } =
  await import('../build/router/createRouter/index.js');
const { default: createPath } =
  await import('../build/router/createPath/index.js');
const { default: anchor } = await import('../build/router/anchor/index.js');
const { default: registerAnchor } =
  await import('../build/router/registerAnchor/index.js');

const router = createRouter({ docs: createPath('docs', anchor()) });

let scrolledIntoView = 0;

// the section mounts after the router has initialised, which is when a pending
// anchor scroll would be resolved
registerAnchor(router.routes.docs, 'deployment').ref(
  fakeElement({ onScroll: () => scrolledIntoView++ })
);

for (let i = 0; i < 4; i++) await tick();

assert.equal(
  scrolledIntoView,
  0,
  'a restored scroll position wins over the url hash, even when it is 0'
);
assert.equal(
  location.hash,
  '#deployment',
  'the hash itself is left alone - only the scroll is suppressed'
);

console.log('anchor-restore.test.ts: all assertions passed');
