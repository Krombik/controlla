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

registerAnchor(router.routes.docsTrack, 'top').ref(null);
registerAnchor(router.routes.docsTrack, 'bottom').ref(null);

// 8d. a scroll-to whose target isn't mounted yet arms a pending retry; the
// first element that mounts afterward (in the same rAF batch) retries it,
// always instant, and skips if the user scrolled away in the meantime

navigate(router.navigation.docs('toc'));
await tick();
assert.equal(location.hash, '#toc', 'pending: nav sets hash');

let scrolledTo: string | undefined;
registerAnchor(router.routes.docs, 'toc').ref(
  fakeElement({
    onScroll: () => {
      scrolledTo = 'toc';
    },
  })
);
await tick();

assert.equal(scrolledTo, 'toc', 'pending: resolved once the element mounted');

registerAnchor(router.routes.docs, 'toc').ref(null);

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

// ---------- initialValue: boot-only, session-flagged ----------

// fresh entry — no history.state, so initialValue applies
history.pushState(null, '', '/items');
current().state = null;

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
assert.equal(current().state.init, 1, 'initial: session flag stamped');

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

// "refresh": same history entry (state.init = 1), router recreated
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

let maxScrollY = 100;
let scrolled: [number, number] | undefined;
windowMock.scroll = (x, y) => {
  scrolled = [x, y];
  windowMock.scrollX = x;
  windowMock.scrollY = Math.min(y, maxScrollY);
};

// pagehide stores the position in history.state
windowMock.scrollY = 321;
for (const fn of listeners.pagehide) fn({});
assert.deepEqual(
  current().state.scroll,
  [0, 321],
  'refresh: scroll saved on pagehide'
);

// "refresh" — the page is short at boot, restore clamps and keeps watching
windowMock.scrollY = 0;
scrolled = undefined;
router3 = makeItemsRouter();
assert.deepEqual(scrolled, [0, 321], 'refresh: restore attempted on boot');
assert.equal(windowMock.scrollY, 100, 'refresh: clamped by short page');
assert.ok(roCallback, 'refresh: growth observer active');

// content grew — the observer re-applies and detaches once reached
maxScrollY = 1000;
roCallback!();
assert.equal(windowMock.scrollY, 321, 'refresh: restored after growth');
assert.equal(roCallback, undefined, 'refresh: observer disconnected');

// ---------- params clearing is deferred to createRouterView ----------
// The router no longer clears params on unmatch itself — it queues the route
// and `createRouterView` drains it after the page swap commits (so a leaving
// page's controls have detached before the value goes). Headless (no view),
// the router alone therefore keeps the last value; a re-match overwrites it.
{
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
