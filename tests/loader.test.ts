import { tick } from './_env/dom.ts';
import assert from 'node:assert';

const { default: createRegistry } =
  await import('../build/core/createRegistry/index.js');
const { default: createAsyncControl } =
  await import('../build/core/createAsyncControl/index.js');
const { default: createPrimitiveControl } =
  await import('../build/core/createPrimitiveControl/index.js');
const { default: pollLoader } =
  await import('../build/loader/pollLoader/index.js');
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
  const $page0 = reg.bind($key, 0);
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
  const $item = reg.bind($key);
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

console.log('loader.test.ts: all assertions passed');
