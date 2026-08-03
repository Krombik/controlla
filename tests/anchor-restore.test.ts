// the env module must come first: it installs the browser mocks
import {
  location,
  entries,
  history,
  resetEntries,
  tick,
  windowMock,
  fakeElement,
  session,
  SCROLL_POS_HISTORY_KEY,
  CURRENT_SCROLL_POS_KEY,
} from './_env/browser.ts';
import assert from 'node:assert';

// A refresh of a url that carries a hash, from a position the user had scrolled
// back to. The saved position is `0, 0`, which is the whole point: restoring it
// moves nothing and so fires no scroll event, and a scroll event is what
// normally cancels the anchor's pending scroll. Without an explicit cancel the
// page jumps to the hash instead of staying where it was left.
entries.length = 0;
entries.push({ url: '/docs#deployment', state: { idx: 0 } });
session[CURRENT_SCROLL_POS_KEY] = '0,0,0';
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
const { default: navigate } = await import('../build/router/navigate/index.js');
const { default: watchValues } =
  await import('../build/core/watchValues/index.js');

const router = createRouter({
  docs: createPath('docs', anchor()),
  other: createPath('other'),
});

const scrolls: Array<[number, number]> = [];

windowMock.onScroll = (x: number, y: number) => {
  scrolls.push([x, y]);
};

let scrolledIntoView = 0;

const section = fakeElement({ onScroll: () => scrolledIntoView++ });

const handle = registerAnchor(router.routes.docs, 'deployment');

// the section mounts after the router has initialised, which is when a pending
// anchor scroll would be resolved
handle.ref(section);

const settle = async () => {
  for (let i = 0; i < 4; i++) await tick();
};

await settle();

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

// Coming back to an entry is the same story: the position the user was at wins
// over the hash the url still carries, as it does in the browser. The page is
// left and re-entered, so the section remounts, which is where the hash would
// otherwise be aimed at again.
windowMock.scrollY = 800;
navigate(router.navigation.other());
await settle();

assert.equal(location.pathname, '/other', 'navigated off the anchored page');

handle.ref(null);

// react renders from within the flush the pop schedules, so the section is back
// before anything after the match runs - the pending anchor has to be gone by
// the time it is registered
watchValues([router.routes.docs], ([isMatched]) => {
  if (isMatched) {
    handle.ref(section);
  }
});

scrolls.length = 0;
history.go(-1);
await settle();

assert.equal(location.pathname, '/docs', 'popped back to the anchored page');
assert.deepEqual(scrolls.at(-1), [0, 800], 'pop: the position was restored');
assert.equal(
  scrolledIntoView,
  0,
  'pop: the hash is not aimed at, the restored position stands'
);

// The other side of the first case: the same url opened on an entry nothing is
// stored against - a link opened in a new tab. There is no position to return
// to, so the hash is the only instruction there is and it applies.
delete session[CURRENT_SCROLL_POS_KEY];
delete session[SCROLL_POS_HISTORY_KEY];
resetEntries({ url: '/docs#deployment', state: null });

const freshRouter = createRouter({ docs: createPath('docs', anchor()) });

let freshAims = 0;

registerAnchor(freshRouter.routes.docs, 'deployment').ref(
  fakeElement({ onScroll: () => freshAims++ })
);

await settle();

// twice: the aim, then the initial observation every observer delivers
assert.equal(freshAims, 2, 'a hash on an unvisited entry is scrolled to');

console.log('anchor-restore.test.ts: all assertions passed');
