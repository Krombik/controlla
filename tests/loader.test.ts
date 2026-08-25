import { dispatchDocument, tick } from './_env/dom.ts';
import assert from 'node:assert';

const { default: createRegistry } =
  await import('../build/core/createRegistry/index.js');
const { default: createBoundControl } =
  await import('../build/core/createBoundControl/index.js');
const { default: createAsyncControl } =
  await import('../build/core/createAsyncControl/index.js');
const { default: createPrimitiveControl } =
  await import('../build/core/createPrimitiveControl/index.js');
const { default: pollLoader } =
  await import('../build/loader/pollLoader/index.js');
const { default: requestLoader } =
  await import('../build/loader/requestLoader/index.js');
import setValue from '../build/core/setValue/index.js';
import getValue from '../build/core/getValue/index.js';
import retain from '../build/core/retain/index.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A paused poll must not let an in-flight request commit and clobber an
// external write. Reproduces a map registry seeding a list page while list
// polling is paused: the page's stale in-flight response must be dropped,
// and polling must resume normally afterwards.

// ---- grouped poll (syncedKeysCount) ----
{
  let resolvers: Array<(v: any) => void> = [];
  const poll = pollLoader(
    (_q: string, _p: number) => new Promise((r) => resolvers.push(r)),
    { interval: 20, isLoaded: (v: any) => v.isFinished, syncedKeysCount: 1 }
  );
  const reg = createRegistry(createAsyncControl, poll);
  const $key = createPrimitiveControl('Q');
  const $page0 = createBoundControl(reg, $key, 0);
  const rel = retain($page0); // active -> page 0 poll fetch in flight
  await tick();

  poll.actions.pause('Q'); // map opens
  setValue(reg.get('Q', 0), { hotels: ['SEED'], isFinished: false });
  await tick();

  // the stale in-flight poll resolves AFTER the seed - must be dropped
  resolvers.shift()!({ hotels: ['STALE'], isFinished: false });
  await tick();
  assert.deepEqual(
    getValue($page0),
    { hotels: ['SEED'], isFinished: false },
    'grouped: stale in-flight poll must not clobber the seed while paused'
  );

  // resume + let the (unpaused) interval elapse -> polling refetches & commits
  poll.actions.resume('Q');
  await sleep(40);
  assert.ok(resolvers.length, 'grouped: resume refetched');
  resolvers.shift()!({ hotels: ['FRESH'], isFinished: true });
  await tick();
  assert.deepEqual(
    getValue($page0),
    { hotels: ['FRESH'], isFinished: true },
    'grouped: resume commits fresh polls again'
  );
  rel();
}

// ---- solo poll (no syncedKeysCount) ----
{
  let resolvers: Array<(v: any) => void> = [];
  const poll = pollLoader(
    (_q: string) => new Promise((r) => resolvers.push(r)),
    {
      interval: 20,
      isLoaded: (v: any) => v.isFinished,
    }
  );
  const reg = createRegistry(createAsyncControl, poll);
  const $key = createPrimitiveControl('Q');
  const $item = createBoundControl(reg, $key);
  const rel = retain($item);
  await tick();

  poll.actions.pause('Q');
  setValue(reg.get('Q'), { hotels: ['SEED'], isFinished: false });
  await tick();

  resolvers.shift()!({ hotels: ['STALE'], isFinished: false });
  await tick();
  assert.deepEqual(
    getValue($item),
    { hotels: ['SEED'], isFinished: false },
    'solo: stale in-flight poll must not clobber the seed while paused'
  );

  poll.actions.resume('Q'); // solo resume refetches immediately when idle
  await tick();
  assert.ok(resolvers.length, 'solo: resume refetched');
  resolvers.shift()!({ hotels: ['FRESH'], isFinished: true });
  await tick();
  assert.deepEqual(
    getValue($item),
    { hotels: ['FRESH'], isFinished: true },
    'solo: resume commits fresh polls again'
  );
  rel();
}

// ---- reloadOnFocus ----
// coming back to the tab reloads without clearing the value, so a consumer
// never sees a gap; the reload marker has to reach the error control, or it
// lands on the value itself
{
  let calls = 0;

  const $favorites = createAsyncControl(
    requestLoader(() => Promise.resolve({ items: [++calls] }), {
      reloadOnFocus: 1,
    })
  );
  const rel = retain($favorites);
  await sleep(5);

  assert.deepEqual(
    getValue($favorites),
    { items: [1] },
    'reloadOnFocus: initial load'
  );

  dispatchDocument('visibilitychange');
  await sleep(5);

  assert.deepEqual(
    getValue($favorites),
    { items: [2] },
    'reloadOnFocus: value kept its shape and reloaded'
  );
  assert.equal(calls, 2, 'reloadOnFocus: reload started');
  rel();
}

// A grouped reset stands in for the group's clock in `_pendingCount`, so it
// must drop the timer handle too - otherwise the next reset decrements for a
// timer that is already gone, ticking a round early and overlapping requests.
{
  let resolvers: Array<(v: any) => void> = [];
  const poll = pollLoader(
    (_q: string, _p: number) => new Promise((r) => resolvers.push(r)),
    { interval: 1000, isLoaded: (v: any) => v.isFinished, syncedKeysCount: 1 }
  );
  const reg = createRegistry(createAsyncControl, poll);
  const rel = retain(createBoundControl(reg, createPrimitiveControl('Q'), 0));
  await tick();

  poll.actions.reset('Q');
  poll.actions.reset('Q');
  await tick();

  assert.equal(
    resolvers.length,
    1,
    'grouped: reset while in flight must not spawn a duplicate request'
  );
  rel();
}

// An external write that already reads as loaded ends the load and runs the
// poll's cleanup - but the request in flight is still the newest thing the
// server said, so it commits. What must not survive is the dead clock: a value
// that reads as loading again restarts the load, and only that new poll ticks.
{
  const resolvers: Array<(v: any) => void> = [];
  const poll = pollLoader(
    (_q: string) => new Promise((r) => resolvers.push(r)),
    { interval: 20, isLoaded: (v: any) => v.isFinished }
  );
  const reg = createRegistry(createAsyncControl, poll);
  const rel = retain(createBoundControl(reg, createPrimitiveControl('Q')));
  await tick();

  setValue(reg.get('Q'), { n: 'LOCAL', isFinished: true });
  await tick();

  resolvers.shift()!({ n: 'FINAL', isFinished: true });
  await tick();

  assert.deepEqual(
    getValue(reg.get('Q')),
    { n: 'FINAL', isFinished: true },
    'solo: what the server answered lands even after an external write ended the load'
  );

  await sleep(40);
  assert.equal(resolvers.length, 0, 'solo: a loaded answer stops the polling');
  rel();
}

// same, but the answer reads as loading - the load restarts, once
{
  const resolvers: Array<(v: any) => void> = [];
  const poll = pollLoader(
    (_q: string) => new Promise((r) => resolvers.push(r)),
    { interval: 20, isLoaded: (v: any) => v.isFinished }
  );
  const reg = createRegistry(createAsyncControl, poll);
  const rel = retain(createBoundControl(reg, createPrimitiveControl('Q')));
  await tick();

  setValue(reg.get('Q'), { n: 'LOCAL', isFinished: true });
  await tick();

  resolvers.shift()!({ n: 'PENDING', isFinished: false });
  await tick();

  assert.deepEqual(
    getValue(reg.get('Q')),
    { n: 'PENDING', isFinished: false },
    'solo: an unfinished answer lands too'
  );

  await sleep(60);
  assert.equal(
    resolvers.length,
    1,
    'solo: one clock polls after the restart, not the dead one as well'
  );

  // the poll that runs is the one the actions reach
  poll.actions.pause('Q');
  resolvers.shift()!({ n: 'STALE', isFinished: false });
  await sleep(60);
  assert.equal(
    resolvers.length,
    0,
    'solo: the restarted poll is the one in storage'
  );
  rel();
}

{
  const resolvers: Array<(v: any) => void> = [];
  const poll = pollLoader(
    (_q: string, _p: number) => new Promise((r) => resolvers.push(r)),
    { interval: 20, isLoaded: (v: any) => v.isFinished, syncedKeysCount: 1 }
  );
  const reg = createRegistry(createAsyncControl, poll);
  const rel = retain(createBoundControl(reg, createPrimitiveControl('Q'), 0));
  await tick();

  setValue(reg.get('Q', 0), { n: 'LOCAL', isFinished: true });
  await tick();

  resolvers.shift()!({ n: 'FINAL', isFinished: true });
  await tick();

  assert.deepEqual(
    getValue(reg.get('Q', 0)),
    { n: 'FINAL', isFinished: true },
    'grouped: what the server answered lands even after an external write ended the load'
  );

  await sleep(40);
  assert.equal(
    resolvers.length,
    0,
    'grouped: a loaded answer stops the polling'
  );
  rel();
}

console.log('loader.test.ts: all assertions passed');
