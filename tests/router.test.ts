// the env module must come first: it installs the browser mocks at evaluation
// time, before any lib module below is evaluated
import {
  listeners,
  entries,
  location,
  history,
  current,
  tick,
  sleep,
  windowMock,
  fakeElement,
  defineGlobal,
  setScrollHeight,
  triggerResize,
  session,
  SCROLL_POS_HISTORY_KEY,
  CURRENT_SCROLL_POS_KEY,
} from './_env/browser.ts';
import assert from 'node:assert';

// ---------- modules ----------

import createRouter from '../build/router/createRouter/index.js';
import createPath from '../build/router/createPath/index.js';
import param from '../build/router/param/index.js';
import query from '../build/router/query/index.js';
import anchor from '../build/router/anchor/index.js';
import navigate from '../build/router/navigate/index.js';
import setValue from '../build/core/setValue/index.js';
import replaceValue from '../build/router/replaceValue/index.js';
import selectParams from '../build/router/selectParams/index.js';
import selectAnchor from '../build/router/selectAnchor/index.js';
import selectRegisteredAnchors from '../build/router/selectRegisteredAnchors/index.js';
import registerAnchor from '../build/router/registerAnchor/index.js';
import trackScroll from '../build/router/trackScroll/index.js';
import getValue from '../build/core/getValue/index.js';
import isSourceUpdate from '../build/core/isSourceUpdate/index.js';
import watchValues from '../build/core/watchValues/index.js';

// ---------- router ----------

const paths = {
  home: createPath(),
  user: createPath(
    'user',
    param({
      id: {
        parse: (v: string) => Number(v),
        stringify: (v: number) => String(v),
      },
    }),
    {
      profile: createPath('profile'),
      posts: createPath('posts', query({ sort: true })),
    }
  ),
  docs: createPath('docs', anchor()),
  docsTrack: createPath('docsTrack', trackScroll(anchor())),
  docsSmooth: createPath(
    'docsSmooth',
    anchor(() => ({ behavior: 'smooth' }))
  ),
};

const router = createRouter(paths);

// 1. initial matching
assert.equal(getValue(router.routes.user), true, 'init: user matched');
assert.equal(
  getValue(router.routes.user.profile),
  true,
  'init: profile matched'
);
assert.equal(getValue(router.routes.home), false, 'init: home unmatched');
assert.equal(getValue(router.routes.docs), false, 'init: docs unmatched');
assert.equal(
  getValue(selectAnchor(router.routes.docs)),
  undefined,
  'init: an unmatched anchor reads as undefined, like params'
);
assert.deepEqual(
  getValue(selectParams(router.routes.user)),
  { id: 5 },
  'init: params'
);
assert.equal(
  getValue(router.navigationState).action,
  'none',
  'init: navigationState'
);
assert.equal(entries.length, 1, 'init: no history writes');

// 2. navigate to another leaf with params
navigate(router.navigation.user({ id: 7 }).posts({ sort: 'asc' }));
await tick();
assert.equal(
  location.pathname + location.search,
  '/user/7/posts?sort=asc',
  'nav: url'
);
assert.equal(getValue(router.routes.user.posts), true, 'nav: posts matched');
assert.equal(
  getValue(router.routes.user.profile),
  false,
  'nav: profile unmatched'
);
assert.deepEqual(
  getValue(selectParams(router.routes.user)),
  { id: 7 },
  'nav: user params'
);
assert.deepEqual(
  getValue(selectParams(router.routes.user.posts)),
  { sort: 'asc' },
  'nav: posts params'
);
assert.equal(
  getValue(router.navigationState).action,
  'push',
  'nav: push action'
);
assert.equal(entries.length, 2, 'nav: pushed entry');

// 3. setValue on a params control — pushes, syncs the URL
setValue(selectParams(router.routes.user.posts), { sort: 'desc' });
await tick();
assert.equal(location.search, '?sort=desc', 'setValue: url');
assert.deepEqual(
  getValue(selectParams(router.routes.user.posts)),
  { sort: 'desc' },
  'setValue: value'
);
assert.equal(entries.length, 3, 'setValue: pushed entry');
assert.equal(
  getValue(router.navigationState).action,
  'push',
  'setValue: push action'
);

// 3b. replaceValue — same write, replaced history entry
replaceValue(selectParams(router.routes.user.posts), { sort: 'top' });
await tick();
assert.equal(location.search, '?sort=top', 'replaceValue: url');
assert.equal(entries.length, 3, 'replaceValue: no new entry');
assert.equal(
  getValue(router.navigationState).action,
  'replace',
  'replaceValue: action'
);

replaceValue(selectParams(router.routes.user.posts), { sort: 'desc' });
await tick();

// 4. navigate with replace
navigate(router.navigation.home(), true);
await tick();
assert.equal(location.pathname, '/', 'replace: url');
assert.equal(entries.length, 3, 'replace: no new entry');
assert.equal(
  getValue(router.navigationState).action,
  'replace',
  'replace: action'
);
assert.equal(getValue(router.routes.home), true, 'replace: home matched');
assert.equal(getValue(router.routes.user), false, 'replace: user unmatched');
// unmatch clears params in a macrotask, not synchronously — so subscribers on
// the leaving page unmount and detach before the value goes; still set here
assert.deepEqual(
  getValue(selectParams(router.routes.user)),
  { id: 7 },
  'replace: params retained until deferred clear'
);

// 5. popstate back
const paramsOrigin: Array<[number, boolean]> = [];
const stopOrigin = watchValue(
  selectParams(router.routes.user),
  (params: any) => {
    paramsOrigin.push([params.id, isSourceUpdate()]);
  }
);
// what a listener writes while handling the pop is its own write
const $echo = createControl(0);
const echoOrigin: boolean[] = [];
const stopEcho = watchValue(selectParams(router.routes.user), (params: any) => {
  setValue($echo, params.id);
});
const stopEchoWatch = watchValue($echo, () => {
  echoOrigin.push(isSourceUpdate());
});
history.go(-1);
await tick();
assert.equal(
  location.pathname + location.search,
  '/user/7/posts?sort=asc',
  'pop: url'
);
assert.equal(getValue(router.navigationState).action, 'pop', 'pop: action');
assert.equal(getValue(router.routes.user.posts), true, 'pop: posts matched');
assert.deepEqual(
  getValue(selectParams(router.routes.user)),
  { id: 7 },
  'pop: user params'
);
assert.deepEqual(
  getValue(selectParams(router.routes.user.posts)),
  { sort: 'asc' },
  'pop: posts params'
);

// 6. popstate through the scroll-save dance (entry 0 stores scroll)
history.go(-1);
await tick();
await tick();
await tick();
assert.equal(location.pathname, '/user/5/profile', 'pop2: url');
assert.equal(
  getValue(router.routes.user.profile),
  true,
  'pop2: profile matched'
);
assert.deepEqual(
  getValue(selectParams(router.routes.user)),
  { id: 5 },
  'pop2: params'
);
assert.equal(getValue(router.navigationState).action, 'pop', 'pop2: action');

// the state the finalizer writes commits with it, so a watcher over both is
// handed one tuple, and a consistent one
const navTuples: Array<[string, number]> = [];
const stopNavTuple = watchValues(
  [router.navigationState, selectParams(router.routes.user)],
  ([state, params]: any) => {
    navTuples.push([state.action, params.id]);
  }
);

// a pop moves the params on its own, a navigate is the app writing them
navigate(router.navigation.user({ id: 8 }).profile(), true);
await tick();
assert.deepEqual(
  navTuples,
  [['replace', 8]],
  'navigationState and the params it belongs to arrive together'
);
stopNavTuple();
assert.deepEqual(
  paramsOrigin,
  [
    [5, true],
    [8, false],
  ],
  'params from history are the source, from a navigate are not'
);
assert.deepEqual(
  echoOrigin,
  [false, false],
  'a write made from a source-driven listener is still a write'
);
stopOrigin();
stopEcho();
stopEchoWatch();
navigate(router.navigation.user({ id: 5 }).profile(), true);
await tick();

// 7. blocked navigation + anchor target
const disable = router.navigationBlocker.enable();
navigate(router.navigation.docs('intro'));
await tick();
assert.equal(getValue(router.routes.docs), false, 'block: parked');
assert.equal(
  getValue(router.navigationBlocker.isPendingNavigation),
  true,
  'block: pending'
);

// deny drops the parked navigation
router.navigationBlocker.isPendingNavigation.deny();
await tick();
assert.equal(
  getValue(router.navigationBlocker.isPendingNavigation),
  false,
  'deny: released'
);
assert.equal(getValue(router.routes.docs), false, 'deny: dropped');
assert.equal(location.pathname, '/user/5/profile', 'deny: url untouched');

// allow proceeds even while the blocker is still enabled
navigate(router.navigation.docs('intro'));
await tick();
assert.equal(
  getValue(router.navigationBlocker.isPendingNavigation),
  true,
  'block: pending again'
);
router.navigationBlocker.isPendingNavigation.allow();
await tick();
assert.equal(
  getValue(router.navigationBlocker.isPendingNavigation),
  false,
  'allow: released'
);
assert.equal(location.pathname + location.hash, '/docs#intro', 'anchor: url');
assert.equal(getValue(router.routes.docs), true, 'anchor: docs matched');
assert.equal(
  getValue(selectAnchor(router.routes.docs)),
  'intro',
  'anchor: hash control'
);
disable();

// 7b. setValue on an unmatched route's params throws (user is unmatched on /docs)
assert.throws(
  () => setValue(selectParams(router.routes.user), { id: 1 }),
  /matched/,
  'setValue: unmatched throws'
);

// 8. setValue on the anchor control
setValue(selectAnchor(router.routes.docs), 'usage');
await tick();
assert.equal(location.hash, '#usage', 'anchor update: url');
assert.equal(
  getValue(selectAnchor(router.routes.docs)),
  'usage',
  'anchor update: value'
);

// without trackScroll, clearing to '' clears both the url and the control
setValue(selectAnchor(router.routes.docs), '');
await tick();
assert.equal(location.hash, '', 'anchor clear: url');
assert.equal(
  getValue(selectAnchor(router.routes.docs)),
  '',
  'anchor clear: value also reset'
);

// 8a2. leaving an anchored route clears its hash control to `undefined`, which
// must not end up concatenated into the next url
navigate(router.navigation.docs('intro'));
await tick();
assert.equal(location.pathname + location.hash, '/docs#intro', 'anchor: set');

navigate(router.navigation.home());
await tick();
assert.equal(location.pathname, '/', 'anchor: left the route');
assert.equal(
  getValue(selectAnchor(router.routes.docs)),
  'intro',
  'leaving the route keeps the anchor until the page unmounts, like params'
);

navigate(router.navigation.docs());
await tick();
assert.equal(
  location.pathname + location.hash,
  '/docs',
  'a cleared hash must not stringify into the url'
);

// 8b. without trackScroll, selectRegisteredAnchors only ever reflects
// mounted state: `true`/`undefined`, never 'active'

navigate(router.navigation.docs('usage'));
await tick();

registerAnchor(router.routes.docs, 'intro').ref(fakeElement());
registerAnchor(router.routes.docs, 'usage').ref(fakeElement());
await tick();

assert.equal(
  getValue(selectRegisteredAnchors(router.routes.docs).intro),
  true,
  'registered: mounted'
);
assert.equal(
  getValue(selectRegisteredAnchors(router.routes.docs).usage),
  true,
  'registered: mounted, matching the anchor does not imply active'
);

setValue(selectAnchor(router.routes.docs), 'intro');
await tick();
assert.equal(
  getValue(selectRegisteredAnchors(router.routes.docs).intro),
  true,
  'registered: an anchor change alone never marks active'
);
assert.equal(
  getValue(selectRegisteredAnchors(router.routes.docs).usage),
  true,
  'registered: unaffected'
);

registerAnchor(router.routes.docs, 'intro').ref(null);
registerAnchor(router.routes.docs, 'usage').ref(null);

// 8c. trackScroll(anchor()): scrollTo only marks its target active once a
// scroll actually happens (not while the target is still unmounted/pending);
// once scrolling starts, the spy re-marks whichever registered section is
// actually in view, without itself ever touching the anchor control or url

navigate(router.navigation.docsTrack('top'));
await tick();
assert.equal(
  getValue(selectRegisteredAnchors(router.routes.docsTrack).top),
  undefined,
  'trackScroll: not active yet, nothing mounted to scroll to'
);
assert.equal(
  getValue(selectAnchor(router.routes.docsTrack)),
  'top',
  'trackScroll: an explicit navigate still sets the anchor control'
);
assert.equal(
  location.hash,
  '#top',
  'trackScroll: an explicit navigate still sets the url'
);

let topRect = { top: 0 };
let bottomRect = { top: 500 };

registerAnchor(router.routes.docsTrack, 'top').ref(
  fakeElement({ rect: () => topRect })
);
registerAnchor(router.routes.docsTrack, 'bottom').ref(
  fakeElement({ rect: () => bottomRect })
);
await tick();

assert.equal(
  getValue(selectRegisteredAnchors(router.routes.docsTrack).top),
  'active',
  'trackScroll: mounting resolves the pending scrollTo, which marks active'
);

for (const fn of listeners.scroll || []) fn({});
await tick();
await tick();

assert.equal(
  getValue(selectRegisteredAnchors(router.routes.docsTrack).top),
  'active',
  'trackScroll: top still visible'
);

// scroll further: the bottom section is now the one in view
topRect = { top: -600 };
bottomRect = { top: 0 };

for (const fn of listeners.scroll || []) fn({});
await tick();
await tick();

assert.equal(
  getValue(selectRegisteredAnchors(router.routes.docsTrack).bottom),
  'active',
  'trackScroll: bottom becomes active on scroll'
);
assert.equal(
  getValue(selectRegisteredAnchors(router.routes.docsTrack).top),
  true,
  'trackScroll: top demoted'
);
assert.equal(
  getValue(selectAnchor(router.routes.docsTrack)),
  'top',
  'trackScroll: scroll-driven updates never touch the anchor control'
);
assert.equal(
  location.hash,
  '#top',
  'trackScroll: scroll-driven updates never touch the url'
);

// The probe sits a quarter into the reading area (200 of this env's 800), not at
// its very top - otherwise a short section's tail holds the highlight while the
// next section already fills the screen.
topRect = { top: -100 };
bottomRect = { top: 250 };

for (const fn of listeners.scroll || []) fn({});
await tick();
await tick();

assert.equal(
  getValue(selectRegisteredAnchors(router.routes.docsTrack).top),
  'active',
  'trackScroll: a section past the probe does not activate yet'
);

// 150 is below the top of the screen but above the probe
bottomRect = { top: 150 };

for (const fn of listeners.scroll || []) fn({});
await tick();
await tick();

assert.equal(
  getValue(selectRegisteredAnchors(router.routes.docsTrack).bottom),
  'active',
  'trackScroll: reaching the probe activates, without waiting for the screen top'
);

// A page that opens with something else above the sections: at the very top none
// of them is on screen yet, so none is being read and none may be marked.
topRect = { top: 900 };
bottomRect = { top: 1400 };

for (const fn of listeners.scroll || []) fn({});
await tick();
await tick();

assert.equal(
  getValue(selectRegisteredAnchors(router.routes.docsTrack).top),
  true,
  'trackScroll: sections still below the fold leave nothing active'
);

// A sliver poking over the bottom of the screen is not being read: the in-view
// fallback keeps the same quarter of clearance the probe uses, measured from the
// bottom edge (600 of this env's 800).
topRect = { top: 700 };
bottomRect = { top: 1200 };

for (const fn of listeners.scroll || []) fn({});
await tick();
await tick();

assert.equal(
  getValue(selectRegisteredAnchors(router.routes.docsTrack).top),
  true,
  'trackScroll: a section barely over the bottom edge is not active yet'
);

// scrolled far enough that the first section has come into view, but not far
// enough for it to reach the probe - it is what's being read
topRect = { top: 400 };
bottomRect = { top: 900 };

for (const fn of listeners.scroll || []) fn({});
await tick();
await tick();

assert.equal(
  getValue(selectRegisteredAnchors(router.routes.docsTrack).top),
  'active',
  'trackScroll: a section in view but short of the probe is the active one'
);

// And a page that fits on one screen is permanently "at the bottom", so the
// bottom override has to be guarded or the last section wins from the start.
setScrollHeight(700);

for (const fn of listeners.scroll || []) fn({});
await tick();
await tick();

assert.equal(
  getValue(selectRegisteredAnchors(router.routes.docsTrack).bottom),
  true,
  'trackScroll: an unscrollable page does not force the last section active'
);
assert.equal(
  getValue(selectRegisteredAnchors(router.routes.docsTrack).top),
  'active',
  'trackScroll: an unscrollable page reads as its first section'
);

setScrollHeight(2000);

// 8c1. A page that opens at the top never fires a scroll event, so mounting the
// sections has to be enough to mark one - and what mounting produces is a change
// in the page's size, which is what the spy actually watches.

// first get to a state where nothing is active, so re-registering cannot smuggle
// the answer in through the `_activeId == id` shortcut
topRect = { top: 900 };
bottomRect = { top: 1400 };

for (const fn of listeners.scroll || []) fn({});
await tick();
await tick();

assert.equal(
  getValue(selectRegisteredAnchors(router.routes.docsTrack).top),
  true,
  'trackScroll: nothing active before the mount check'
);

registerAnchor(router.routes.docsTrack, 'top').ref(null);
registerAnchor(router.routes.docsTrack, 'bottom').ref(null);
await tick();

topRect = { top: 0 };
bottomRect = { top: 500 };

registerAnchor(router.routes.docsTrack, 'top').ref(
  fakeElement({ rect: () => topRect })
);
registerAnchor(router.routes.docsTrack, 'bottom').ref(
  fakeElement({ rect: () => bottomRect })
);
await tick();
// the sections just took up space - and the browser delivers this after the
// frame's callbacks, so it lands on top of the value the refs queued
triggerResize();
await tick();
await tick();

assert.equal(
  getValue(selectRegisteredAnchors(router.routes.docsTrack).top),
  'active',
  'trackScroll: the page growing runs the spy, with no scroll event to trigger it'
);

// unmounting the active section: it leaves the registered set entirely, and the
// spy handing the highlight on must not write it back in as merely inactive
registerAnchor(router.routes.docsTrack, 'top').ref(null);
bottomRect = { top: 0 };
await tick();
triggerResize();
await tick();
await tick();

assert.equal(
  getValue(selectRegisteredAnchors(router.routes.docsTrack).top),
  undefined,
  'trackScroll: an unmounted active section reads as absent, not inactive'
);
assert.equal(
  getValue(selectRegisteredAnchors(router.routes.docsTrack).bottom),
  'active',
  'trackScroll: the highlight moves to what is left'
);

registerAnchor(router.routes.docsTrack, 'top').ref(
  fakeElement({ rect: () => topRect })
);
await tick();

// 8c2. leaving the page with a scroll frame still queued must not leave the
// handle behind, or `??=` never schedules the spy again on the next visit
for (const fn of listeners.scroll || []) fn({}); // queues a frame

navigate(router.navigation.docs());

// microtasks only: the navigation commits, and so `_clear` runs, while the
// queued frame (a timer here) is still outstanding
for (let i = 0; i < 5; i++) await Promise.resolve();

await tick();

navigate(router.navigation.docsTrack());
await tick();

// `bottom` is still the active id, so re-registering marks it active again -
// only the spy can promote `top`, which makes this assertion load-bearing
topRect = { top: 0 };
bottomRect = { top: 500 };

registerAnchor(router.routes.docsTrack, 'top').ref(
  fakeElement({ rect: () => topRect })
);
registerAnchor(router.routes.docsTrack, 'bottom').ref(
  fakeElement({ rect: () => bottomRect })
);
await tick();

for (const fn of listeners.scroll || []) fn({});
await tick();
await tick();

assert.equal(
  getValue(selectRegisteredAnchors(router.routes.docsTrack).top),
  'active',
  'trackScroll: the spy still runs after revisiting the page'
);

registerAnchor(router.routes.docsTrack, 'top').ref(null);
registerAnchor(router.routes.docsTrack, 'bottom').ref(null);

// 8d. a scroll-to whose target isn't mounted yet arms a pending retry; the
// first element that mounts afterward (in the same rAF batch) retries it,
// always instant, and skips if the user scrolled away in the meantime

navigate(router.navigation.docs('toc'));
await tick();
assert.equal(location.hash, '#toc', 'pending: nav sets hash');

let scrolledTo: string | undefined;
let aims = 0;
registerAnchor(router.routes.docs, 'toc').ref(
  fakeElement({
    onScroll: () => {
      scrolledTo = 'toc';

      aims++;
    },
  })
);
await tick();

assert.equal(scrolledTo, 'toc', 'pending: resolved once the element mounted');

// content above the target keeps arriving after that first aim, pushing the
// section off the position it was just scrolled to, so it is re-aimed on reflow
const aimsBefore = aims;
triggerResize();

assert.equal(aims, aimsBefore + 1, 'pending: re-aimed after the page reflowed');

// and it stops as soon as the user takes over (a copy: each `stop` unsubscribes)
for (const fn of [...(listeners.wheel || [])]) fn({});
triggerResize();

assert.equal(
  aims,
  aimsBefore + 1,
  'pending: stops re-aiming once the user scrolls'
);

registerAnchor(router.routes.docs, 'toc').ref(null);

// a scroll-to on a page already open, whose target has unmounted to reload its
// data, waits for it to come back - the same as arriving at the page would
navigate(router.navigation.docs('later'));
await tick();

let scrolledLater = 0;
registerAnchor(router.routes.docs, 'later').ref(
  fakeElement({
    onScroll: () => {
      scrolledLater++;
    },
  })
);
await tick();

assert.ok(scrolledLater > 0, 'pending: a remounted target still gets scrolled');

registerAnchor(router.routes.docs, 'later').ref(null);

// a section that remounts while an aim is still in flight - suspense resolving,
// a list swapping keys - is followed: the aim resolves the element on every run,
// so it lands on the node that replaced the one it started on
navigate(router.navigation.docs('swap'));
await tick();

const swapHandle = registerAnchor(router.routes.docs, 'swap');
swapHandle.ref(fakeElement({ onScroll: () => {} }));
await tick();

let aimedAtReplacement = 0;
swapHandle.ref(null);
swapHandle.ref(fakeElement({ onScroll: () => aimedAtReplacement++ }));
triggerResize();

assert.ok(
  aimedAtReplacement > 0,
  'pending: the aim follows the section that remounted under it'
);

swapHandle.ref(null);

// the retry always uses instant scroll, even if the anchor is configured smooth
navigate(router.navigation.docsSmooth('x'));
await tick();

let capturedBehavior: string | undefined;
registerAnchor(router.routes.docsSmooth, 'x').ref(
  fakeElement({
    onScroll: (opts) => {
      capturedBehavior = opts && opts.behavior;
    },
  })
);
await tick();

assert.equal(
  capturedBehavior,
  'instant',
  'pending retry: instant, not the configured smooth behavior'
);

registerAnchor(router.routes.docsSmooth, 'x').ref(null);

// a pending retry is cancelled if the user scrolls while it's waiting
navigate(router.navigation.docs('toc2'));
await tick();

for (const fn of listeners.scroll || []) fn({});

let scrolledTo2: string | undefined;
registerAnchor(router.routes.docs, 'toc2').ref(
  fakeElement({
    onScroll: () => {
      scrolledTo2 = 'toc2';
    },
  })
);
await tick();

assert.equal(
  scrolledTo2,
  undefined,
  'pending: retry cancelled, the user scrolled while it was waiting'
);

registerAnchor(router.routes.docs, 'toc2').ref(null);
windowMock.scrollY = 0;

// 9. navigate to an unmatched param route without params throws
assert.throws(
  // @ts-expect-error a zero-arg leaf call is a runtime-only escape hatch:
  // the types require params, the runtime falls back to the current ones
  // and throws when the route isn't matched
  () => navigate(router.navigation.user().posts()),
  /not matched/,
  'throw: unmatched without params'
);

// ---------- lagging lane can't replay stale router state ----------

navigate(router.navigation.user({ id: 7 }).posts({ sort: 'asc' }));
await tick();
assert.equal(
  location.pathname + location.search,
  '/user/7/posts?sort=asc',
  'race: setup'
);

// filter change accumulates in a slow (debounce-like) lane...
const slowScheduler = (cb: () => void) => setTimeout(cb, 20);
setValue(
  selectParams(router.routes.user.posts),
  { sort: 'desc' },
  slowScheduler
);

// ...but a link click navigates away before the slow lane flushes —
// navigate drops the accumulated update
navigate(router.navigation.home());
await tick();
assert.equal(location.pathname, '/', 'race: navigation applied');

// slow lane fires — its patch was dropped, no redirect back, no URL churn
await sleep(30);
assert.equal(location.pathname + location.search, '/', 'race: no stale replay');
assert.equal(getValue(router.routes.home), true, 'race: still home');

// ---------- per-lane updates: each scheduler commits its own batch ----------

navigate(router.navigation.user({ id: 7 }).posts({ sort: 'asc' }));
await tick();
assert.equal(
  location.pathname + location.search,
  '/user/7/posts?sort=asc',
  'lanes: setup'
);

// update user in the microtask lane, posts in a slow lane; the microtask
// flush must NOT commit the slow lane's batch
setValue(selectParams(router.routes.user), { id: 8 });
setValue(
  selectParams(router.routes.user.posts),
  { sort: 'desc' },
  slowScheduler
);
await tick();
assert.deepEqual(
  getValue(selectParams(router.routes.user)),
  { id: 8 },
  'lanes: fast committed'
);
assert.equal(
  location.pathname + location.search,
  '/user/8/posts?sort=asc',
  'lanes: slow not committed'
);
await sleep(30);
assert.deepEqual(
  getValue(selectParams(router.routes.user.posts)),
  { sort: 'desc' },
  'lanes: slow committed'
);
assert.equal(
  location.pathname + location.search,
  '/user/8/posts?sort=desc',
  'lanes: slow url'
);

// ---------- setValue on nested controls ----------

navigate(router.navigation.user({ id: 7 }).posts({ sort: 'asc' }));
await tick();

// direct value on a nested control — only that slice patches
setValue(selectParams(router.routes.user).id, 12);
await tick();
assert.deepEqual(
  getValue(selectParams(router.routes.user)),
  { id: 12 },
  'nested: value applied'
);
assert.equal(location.pathname, '/user/12/posts', 'nested: url synced');

// updater resolves against the nested committed value
setValue(selectParams(router.routes.user).id, (prev: number) => prev + 1);
await tick();
assert.deepEqual(
  getValue(selectParams(router.routes.user)),
  { id: 13 },
  'nested: updater'
);
assert.equal(location.pathname, '/user/13/posts', 'nested: updater url');
assert.deepEqual(
  getValue(selectParams(router.routes.user.posts)),
  { sort: 'asc' },
  'nested: sibling untouched'
);

// ---------- async params go through the same finalizer flow ----------

import createAsyncPath from '../build/router/createAsyncPath/index.js';
import createControl from '../build/core/createControl/index.js';

history.replaceState({ idx: 0 }, '', '/conv/10');

const src = createControl<{ mult: number } | undefined>(undefined);

const router2 = createRouter({
  conv: createAsyncPath(src)(
    'conv',
    param({
      id: {
        parse: (v: string, s: { mult: number }) => Number(v) * s.mult,
        stringify: (v: number) => String(v),
      },
    })
  ),
});

// source not ready — params loading, raw URL untouched
assert.equal(getValue(router2.routes.conv), true, 'async: matched');
assert.equal(
  getValue(selectParams(router2.routes.conv)),
  undefined,
  'async: loading'
);
assert.equal(location.pathname, '/conv/10', 'async: raw url kept');

setValue(src, { mult: 2 });
await tick();
assert.deepEqual(
  getValue(selectParams(router2.routes.conv)),
  { id: 20 },
  'async: parsed'
);
// parse replaced the value (10 * 2 = 20) — finalizer normalized the URL
assert.equal(
  location.pathname,
  '/conv/20',
  'async: url normalized by finalizer'
);

// non-replacing source change — no URL churn
setValue(src, { mult: 1 });
await tick();
assert.deepEqual(
  getValue(selectParams(router2.routes.conv)),
  { id: 20 },
  'async: reparsed'
);
assert.equal(location.pathname, '/conv/20', 'async: url stable');

// ---------- schedulers: sync flush + current-lane join ----------

import syncScheduler from '../build/scheduler/syncScheduler/index.js';
import createManualScheduler from '../build/scheduler/createManualScheduler/index.js';
import watchValue from '../build/core/watchValue/index.js';
import batch from '../build/core/batch/index.js';

const a = createControl(0);
const b = createControl(0);

// syncScheduler commits immediately
setValue(a, 1, syncScheduler);
assert.equal(getValue(a), 1, 'sched: sync immediate commit');

// setValue inside a watcher joins the running flush — b commits in the same
// sync flush, observable right after the call
const unwatchA = watchValue(a, (v: number) => {
  setValue(b, v * 10);
});
setValue(a, 2, syncScheduler);
assert.equal(getValue(b), 20, 'sched: watcher write joined the flush');
unwatchA();

// batch with a custom scheduler — default setValue joins the batch lane
// (previously escaped to the microtask lane)
const manual = createManualScheduler();
batch(() => {
  setValue(a, 3);
  setValue(b, 30);
}, manual);
await tick();
assert.equal(getValue(a), 2, 'sched: batch not committed before flush');
manual.flush();
assert.equal(getValue(a), 3, 'sched: batch committed on flush');
assert.equal(getValue(b), 30, 'sched: batch writes joined the batch lane');

// ---------- initialValue: boot-only, decided by the stored scroll ----------

// a fresh entry: nothing stored against it, so initialValue applies
history.pushState(null, '', '/items');
current().state = null;
delete session[SCROLL_POS_HISTORY_KEY];
delete session[CURRENT_SCROLL_POS_KEY];

const makeItemsRouter = () =>
  createRouter({
    items: createPath(
      'items',
      query({ sort: { optional: true, initialValue: 'asc' } })
    ),
    other: createPath('other'),
  });

let router3 = makeItemsRouter();
assert.deepEqual(
  getValue(selectParams(router3.routes.items)),
  { sort: 'asc' },
  'initial: applied on boot'
);
await tick();
assert.equal(location.search, '?sort=asc', 'initial: url normalized');
assert.equal(current().state.idx, 0, 'initial: the entry is stamped');

// clearing via setValue — stays cleared, absence now means undefined
setValue(selectParams(router3.routes.items), {});
await tick();
assert.equal(location.search, '', 'initial: cleared url');
assert.deepEqual(
  getValue(selectParams(router3.routes.items)),
  {},
  'initial: cleared value'
);

// navigate away and back without the param — no resurrection
navigate(router3.navigation.items({}));
await tick();
assert.deepEqual(
  getValue(selectParams(router3.routes.items)),
  {},
  'initial: nav absence = undefined'
);
assert.equal(location.search, '', 'initial: nav url clean');

// "refresh": the same entry, and now a position is stored against it
session[CURRENT_SCROLL_POS_KEY] = `${current().state.idx},0,0`;
router3 = makeItemsRouter();
assert.equal(
  getValue(selectParams(router3.routes.items)).sort,
  undefined,
  'initial: refresh skips'
);
await tick();
assert.equal(location.search, '', 'initial: refresh url untouched');

// ---------- scroll save on refresh ----------

let roCallback: (() => void) | undefined;

defineGlobal(
  'ResizeObserver',
  class {
    constructor(cb: () => void) {
      roCallback = cb;
    }
    observe() {}
    disconnect() {
      roCallback = undefined;
    }
  }
);

const docEl = document.documentElement as { scrollHeight: number };
let scrolled: [number, number] | undefined;
docEl.scrollHeight = 900; // max scroll = 900 - innerHeight(800) = 100
windowMock.onScroll = (x, y) => {
  scrolled = [x, y];
  windowMock.scrollX = x;
  windowMock.scrollY = Math.min(y, docEl.scrollHeight - windowMock.innerHeight);
};

// no unload event is reliable, so scrolling keeps the position up to date
windowMock.scrollY = 321;
for (const fn of listeners.scroll) fn();
await sleep(150);
assert.equal(
  session[CURRENT_SCROLL_POS_KEY],
  `${current().state.idx},0,321`,
  'refresh: scroll saved against the entry it belongs to'
);

// "refresh" — page too short to reach 321, so it doesn't scroll (no clamp)
windowMock.scrollY = 0;
windowMock.scrollX = 0;
scrolled = undefined;
router3 = makeItemsRouter();
assert.equal(scrolled, undefined, 'refresh: not scrolled while page too short');
assert.ok(roCallback, 'refresh: growth observer active');

// content grew tall enough — now it lands exactly on the saved position
docEl.scrollHeight = 1800; // max scroll = 1000
roCallback!();
assert.deepEqual(scrolled, [0, 321], 'refresh: restored once reachable');
assert.equal(windowMock.scrollY, 321, 'refresh: at saved position');
assert.ok(roCallback, 'refresh: still watching after growth');

// a real user scroll (input event) → stop; browser reflow clamps don't
for (const fn of listeners.wheel || []) fn({});
assert.equal(roCallback, undefined, 'refresh: stops on user input');

// ---------- params clearing is deferred to createRouterView ----------
// The router no longer clears params on unmatch itself — it queues the route
// and `createRouterView` drains it after the page swap commits (so a leaving
// page's controls have detached before the value goes). Headless (no view),
// the router alone therefore keeps the last value; a re-match overwrites it.
{
  // `paths` has no not-found route, so it has to be built on a url it matches
  history.pushState(null, '', '/');

  const dRouter = createRouter(paths);

  navigate(dRouter.navigation.user({ id: 42 }).profile());
  await tick();
  assert.deepEqual(
    getValue(selectParams(dRouter.routes.user)),
    { id: 42 },
    'unmatch: matched params'
  );

  navigate(dRouter.navigation.home());
  await tick();
  await tick();
  assert.deepEqual(
    getValue(selectParams(dRouter.routes.user)),
    { id: 42 },
    'unmatch: router alone keeps params until the view flushes'
  );

  navigate(dRouter.navigation.user({ id: 9 }).profile());
  await tick();
  assert.deepEqual(
    getValue(selectParams(dRouter.routes.user)),
    { id: 9 },
    'unmatch: re-match overwrites'
  );
}

console.log('router.test.ts: all assertions passed');
