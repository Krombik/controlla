// the env module must come first: it installs the browser mocks
import { tick, reportedErrors } from './_env/dom.ts';
import assert from 'node:assert';

const { default: createControl } =
  await import('../build/core/createControl/index.js');
const { default: createPrimitiveControl } =
  await import('../build/core/createPrimitiveControl/index.js');
const { default: createAsyncControl } =
  await import('../build/core/createAsyncControl/index.js');
const { default: createDerivedControl } =
  await import('../build/core/createDerivedControl/index.js');
const { default: createAsyncDerivedControl } =
  await import('../build/core/createAsyncDerivedControl/index.js');
const { default: createSnapshotControl } =
  await import('../build/core/createSnapshotControl/index.js');
const { default: isSourceUpdate } =
  await import('../build/core/isSourceUpdate/index.js');
const { default: createRegistry } =
  await import('../build/core/createRegistry/index.js');
import setValue from '../build/core/setValue/index.js';
import getValue from '../build/core/getValue/index.js';
const { default: invalidate } =
  await import('../build/core/invalidate/index.js');
const { default: toPromise } = await import('../build/core/toPromise/index.js');
const { default: selectLoading } =
  await import('../build/core/selectLoading/index.js');
const { default: watchValue } =
  await import('../build/core/watchValue/index.js');
const { default: watchValues } =
  await import('../build/core/watchValues/index.js');
import retain from '../build/core/retain/index.js';
const { default: createManualScheduler } =
  await import('../build/scheduler/createManualScheduler/index.js');

// derived: recompute + local override semantics (_upToDate rename)
const $a = createPrimitiveControl(1);
const $b = createPrimitiveControl(2);
const $sum = createDerivedControl($a, $b, (a: number, b: number) => a + b);
assert.equal(getValue($sum), 3);
setValue($a, 10);
await tick();
assert.equal(getValue($sum), 12, 'derived recompute');
setValue($sum, 99); // local override
await tick();
assert.equal(getValue($sum), 99, 'derived local override');
setValue($b, 5); // source wins on next flush
await tick();
assert.equal(getValue($sum), 15, 'source recompute overrides');

// same-flush: source beats local set
setValue($sum, 1000);
setValue($a, 1);
await tick();
assert.equal(getValue($sum), 6, 'same flush: source wins');

// watchValue with values + cleanup (Notifier _attachedTo rename)
let seen: any[] = [];
const unwatch = watchValue($a, (v: number, p: number) => {
  seen.push([v, p]);
});
setValue($a, 7);
await tick();
assert.deepEqual(seen, [[7, 1]], 'watchValue');
unwatch();

// async control + silent invalidate (SILENT_RELOAD bug fix)
let fetchCount = 0;
const $async = createAsyncControl({
  load(handle: any) {
    fetchCount++;
    handle.setValue(fetchCount * 100);
  },
});
const release = retain($async);
await tick();
assert.equal(getValue($async), 100, 'async loaded');
invalidate($async); // loud: clears value, reloads
await tick();
assert.equal(getValue($async), 200, 'loud invalidate reloads');
// silent: keeps value while reloading, on the same lane as any other set
const reloaded = invalidate($async, true);

assert.equal(fetchCount, 2, 'silent: nothing reloads before the flush');

assert.equal(await reloaded, 300, 'the promise is the reload own answer');
assert.equal(fetchCount, 3, 'silent: reloaded on the flush');
assert.equal(getValue($async), 300, 'silent invalidate reloaded');

// silent keeps value mid-flight: async loader
let resolveNext: any;
let count2 = 0;
const $async2 = createAsyncControl({
  load(handle: any) {
    count2++;
    new Promise((r) => {
      resolveNext = r;
    }).then((v) => handle.setValue(v));
  },
});
const rel2 = retain($async2);
resolveNext(1);
await tick();
assert.equal(getValue($async2), 1);
invalidate($async2, true);
await tick();
assert.equal(count2, 2, 'silent: the reload started');
assert.equal(getValue($async2), 1, 'silent: value kept while reloading');
assert.equal(getValue(selectLoading($async2)), true, 'silent: loading again');
resolveNext(2);
await tick();
assert.equal(getValue($async2), 2, 'silent: new value committed');

// a silent reload keeps its value, but the promise must follow the reload - the
// patch is what arms it, so a `toPromise` before the flush is the reload's too
invalidate($async2, true);
let isSettled = false;
const reloading = toPromise($async2).then((v: any) => {
  isSettled = true;

  return v;
});
await tick();
assert.equal(isSettled, false, 'silent: promise pending while reloading');
resolveNext(3);
await tick();
assert.equal(await reloading, 3, 'silent: promise resolves with the reload');

// a silent reload from inside a flush joins that flush - which is why the
// promise is armed by the patch, not the commit
const $trigger = createPrimitiveControl(0);
let seenInFlush: any = 'pending';
const unwatchTrigger = watchValue($trigger, () => {
  invalidate($async2, true);
  toPromise($async2).then((v: any) => {
    seenInFlush = v;
  });
});
setValue($trigger, 1);
await tick();
assert.equal(
  seenInFlush,
  'pending',
  'silent in a flush: kept value not settled'
);
resolveNext(4);
await tick();
assert.equal(seenInFlush, 4, 'silent in a flush: resolves with the reload');
unwatchTrigger();

// a poll is loading with a value in hand, and that value is what the next page
// waits for - only a silent reload defers the promise, not any load
const $poll = createAsyncControl({
  isLoaded: (v: any) => v.done,
  load(handle: any) {
    handle.setValue({ done: false });
  },
});
const relPoll = retain($poll);
await tick();
assert.equal(getValue(selectLoading($poll)), true, 'poll: still loading');
assert.deepEqual(
  await toPromise($poll),
  { done: false },
  'poll: promise resolves with the value in hand'
);
relPoll();

// a reload answering with the value already held commits as UNCHANGED, but the
// load did end - loading/ready must follow the patch, not the value
const $same = createAsyncControl({
  load(handle: any) {
    handle.setValue({ n: 1 });
  },
});
const relSame = retain($same);
await tick();
assert.equal(getValue(selectLoading($same)), false, 'unchanged: initial load');
invalidate($same, true);
await tick();
assert.equal(
  getValue(selectLoading($same)),
  false,
  'unchanged reload still clears loading'
);
relSame();

// a status control carries a status, not the value the control is waiting for -
// so watching one reports the stretch where there is no value, like any control
const $statusSrc = createAsyncControl({
  load(handle: any) {
    handle.setValue(1);
  },
});
const relStatus = retain($statusSrc);
await tick();
const loadingSeen: boolean[] = [];
const stopLoading = watchValue(selectLoading($statusSrc), (v: boolean) => {
  loadingSeen.push(v);
});
invalidate($statusSrc);
await tick();
assert.deepEqual(loadingSeen, [true, false], 'loading: both ends reported');
stopLoading();
relStatus();

// unsubscribing twice must be a no-op, not remove somebody else: the swap-pop
// helper used to drop the last entry whether or not it found the item
const $shared = createPrimitiveControl('a');
const firstSeen: string[] = [];
const otherSeen: string[] = [];
const stopFirst = watchValues([$shared], ([v]) => {
  firstSeen.push(v as string);
});
const stopOther = watchValues([$shared], ([v]) => {
  otherSeen.push(v as string);
});
stopFirst();
stopFirst();
setValue($shared, 'z');
await tick();
assert.deepEqual(firstSeen, [], 'unsubscribed watcher stayed quiet');
assert.deepEqual(otherSeen, ['z'], 'a double unwatch kept the other watcher');
stopOther();

// registry get/bind/delete (_bound/_initArg/_holdingPrev renames)
const reg = createRegistry(createControl, (id: number) => `item-${id}`);
assert.equal(getValue(reg.get(1)), 'item-1');
assert.equal(reg.get(1), reg.get(1), 'cached');
const $key = createPrimitiveControl(1);
const $bound = reg.bind($key);
assert.equal(getValue($bound), 'item-1', 'bound initial');
const keySeen: boolean[] = [];
const stopKeySeen = watchValue($bound, () => {
  keySeen.push(isSourceUpdate());
});
setValue($key, 2);
await tick();
assert.equal(getValue($bound), 'item-2', 'bound retarget');
assert.deepEqual(
  keySeen,
  [false],
  'bound: a key somebody wrote retargets it, and that is a write'
);
stopKeySeen();
setValue($bound, 'patched');
await tick();
assert.equal(getValue(reg.get(2)), 'patched', 'bound write forwards to target');
assert.equal(reg.delete(2), true);

// async derived (sourceChangeNotify/sourceErrorNotify renames)
const $src = createAsyncControl<number>();
const $doubled = createAsyncDerivedControl($src, (v: number) => v * 2);
assert.equal(getValue($doubled), undefined);
setValue($src, 21);
await tick();
assert.equal(getValue($doubled), 42, 'async derived');

// isSourceUpdate: a write is an edit, a load or a recompute isn't
const $server = createAsyncControl<number>();
const $editable = createAsyncDerivedControl($server, (v: number) => v);
const submitted: number[] = [];
const stopSubmit = watchValue($editable, (v: number) => {
  if (!isSourceUpdate()) {
    submitted.push(v);
  }
});
setValue($server, 1);
await tick();
setValue($editable, 5);
await tick();
assert.deepEqual(submitted, [5], 'a write is an edit');
invalidate($server);
await tick();
setValue($server, 9); // what came back isn't what was submitted
await tick();
assert.deepEqual(submitted, [5], 'a source recompute is not an edit');
assert.equal(getValue($editable), 9, 'the value did follow the source');
stopSubmit();

// the loader is what marks a value as the source's - a poll keeps handing them
// over with the loading long done
let poll: (value: number) => void;
const $polled = createAsyncControl<number>({
  isLoaded: () => true,
  load(handle: any) {
    poll = (value: number) => handle.setValue(value);
  },
});
const relPolled = retain($polled);
await tick();
poll!(1); // the first one: an arrival, not a change
await tick();
const pollSeen: Array<[number, boolean]> = [];
const stopPoll = watchValue($polled, (v: number) => {
  pollSeen.push([v, isSourceUpdate()]);
});
poll!(2);
await tick();
assert.equal(
  getValue(selectLoading($polled)),
  false,
  'the poll is not loading'
);
poll!(3);
await tick();
setValue($polled, 4);
await tick();
assert.deepEqual(
  pollSeen,
  [
    [2, true],
    [3, true],
    [4, false],
  ],
  'every value the loader hands over is the source, a write is not'
);
stopPoll();
relPolled();

// async once: the first ready value, then the sources are let go
const $onceSrc = createAsyncControl<number>();
const $once = createSnapshotControl($onceSrc, (v: number) => v * 2);
assert.equal(getValue($once), undefined, 'async once: loading');
setValue($onceSrc, 3);
await tick();
assert.equal(getValue($once), 6, 'async once: first ready value');
setValue($onceSrc, 100);
await tick();
assert.equal(getValue($once), 6, 'async once: no recompute');
setValue($once, 7);
await tick();
assert.equal(getValue($once), 7, 'async once: settable after it computed');

// a source that is ready at build time is never watched at all
const $onceReady = createSnapshotControl($onceSrc, (v: number) => v + 1);
assert.equal(getValue($onceReady), 101, 'async once: computed at build');
setValue($onceSrc, 200);
await tick();
assert.equal(
  getValue($onceReady),
  101,
  'async once: build-time compute is final'
);

// multi-source: waits for every one of them, then once
const $onceA = createAsyncControl<number>();
const $onceB = createAsyncControl<number>();
const $onceSum = createSnapshotControl(
  $onceA,
  $onceB,
  (a: number, b: number) => a + b
);
setValue($onceA, 1);
await tick();
assert.equal(getValue($onceSum), undefined, 'async once: one source short');
setValue($onceB, 2);
await tick();
assert.equal(getValue($onceSum), 3, 'async once: multi-source');
setValue($onceA, 10);
await tick();
assert.equal(getValue($onceSum), 3, 'async once: multi-source no recompute');

// $never's status controls are valid derived-control sources (attach-safe)
const { default: $never } = await import('../build/core/never/index.js');
const $neverDerived = createDerivedControl(
  selectLoading($never),
  $never,
  (loading: boolean, value: unknown) => [loading, value]
);
assert.deepEqual(
  getValue($neverDerived),
  [true, undefined],
  '$never as derived source'
);

const { default: watchSlowLoading } =
  await import('../build/core/watchSlowLoading/index.js');
const unwatchNever = watchSlowLoading($never, () => {
  throw new Error('$never slow-loading fired');
});
assert.equal(
  typeof unwatchNever,
  'function',
  'watchSlowLoading($never) is a no-op'
);
unwatchNever();

// retain (and bound controls holding a derived key) attach a derived control
// via `_attach(undefined, undefined, true)` — the retain-only path must not
// try to add a listener. Covers single- and multi-source derived.
const $k1 = createAsyncControl<number>();
const $single = createAsyncDerivedControl($k1, (v: number) => v * 2);
const relSingle = retain($single);
setValue($k1, 4);
await tick();
assert.equal(
  getValue($single),
  8,
  'retained single-source async derived loads'
);
relSingle();

const $k2 = createAsyncControl<number>();
const $k3 = createAsyncControl<number>();
const $multi = createAsyncDerivedControl(
  $k2,
  $k3,
  (a: number, b: number) => a + b
);
const relMulti = retain($multi);
setValue($k2, 2);
setValue($k3, 3);
await tick();
assert.equal(getValue($multi), 5, 'retained multi-source async derived loads');
relMulti();

// array `.length` is a readonly child control that fires only on count change
const $list = createControl([1, 2, 3]);
assert.equal(getValue($list.length), 3, 'length initial');
const lengthSeen: number[] = [];
const unLength = watchValue($list.length, (v: number) => {
  lengthSeen.push(v);
});
setValue($list, [1, 2, 3, 4]); // 3 -> 4
await tick();
setValue($list, [9, 8, 7, 6]); // still 4: same length, different items
await tick();
setValue($list, [1]); // 4 -> 1
await tick();
assert.deepEqual(lengthSeen, [4, 1], 'length notifies only when count changes');
assert.equal(getValue($list.length), 1, 'length current');
unLength();

// `.length` under an async parent: the readonly length child reads through an
// unloaded root as Nil, then the count once the array resolves
const $asyncList = createAsyncControl<number[]>();
assert.equal(
  getValue($asyncList.length),
  undefined,
  'length under async parent: Nil while unloaded'
);
setValue($asyncList, [1, 2, 3, 4, 5]);
await tick();
assert.equal(
  getValue($asyncList.length),
  5,
  'length under async parent: count once resolved'
);

// watchValues hands the tuple over a level later, and carries it too
let pushWatched: (value: number) => void;
const $watchedA = createAsyncControl<number>({
  isLoaded: () => true,
  load(handle: any) {
    pushWatched = (value: number) => handle.setValue(value);
  },
});
const $watchedB = createPrimitiveControl(0);
const relTuple = retain($watchedA);
await tick();
pushWatched!(1);
await tick();
const tupleSeen: boolean[] = [];
const stopTuple = watchValues([$watchedA, $watchedB], ([a]: any) => {
  tupleSeen.push(isSourceUpdate());

  return void a;
});
pushWatched!(2);
await tick();
setValue($watchedB, 5);
await tick();
assert.deepEqual(
  tupleSeen,
  [true, false],
  'watchValues: the loader moved the tuple, then a write did'
);
stopTuple();
relTuple();

// a bound control reports what the change was for the target it mirrors
const pushes: Record<number, (value: any) => void> = {};
const originReg = createRegistry(createAsyncControl, {
  isLoaded: () => true,
  load(handle: any, keys: any) {
    const key = keys[0] as number;

    pushes[key] = (value: any) => handle.setValue(value);

    handle.setValue({ n: key });
  },
});
const $originKey = createPrimitiveControl(1);
const $originBound = originReg.bind($originKey) as any;
const relOrigin = retain($originBound);
await tick();
const boundSeen: Array<[number, boolean]> = [];
const stopBound = watchValue($originBound, (v: any) => {
  boundSeen.push([v.n, isSourceUpdate()]);
});
pushes[1]({ n: 11 }); // the target's loader
await tick();
setValue($originBound, { n: 12 }); // a write, forwarded to the target
await tick();
setValue($originKey, 2); // a retarget, and the new target loads
await tick();
assert.deepEqual(
  boundSeen,
  [
    [11, true],
    [12, false],
    [2, true],
  ],
  'bound: the loader and the retarget are the source, the write is not'
);
stopBound();
relOrigin();

// a derived over a BOUND control's child must recompute: the derived has to
// activate the source child on the bound target, not just retain its load
const boundReg = createRegistry(createAsyncControl, {
  load(handle: any, keys: any) {
    handle.setValue({ n: (keys[0] as number) * 10 });
  },
});
const $boundId = createPrimitiveControl(1);
const $boundItem = boundReg.bind($boundId) as any;
const $overBoundChild = createDerivedControl(
  $boundItem.n,
  (n: number | undefined) => n
);
const relBoundChild = retain($overBoundChild);
await tick();
assert.equal(
  getValue($overBoundChild),
  10,
  'derived over bound child: initial'
);
setValue($boundId, 2);
await tick();
assert.equal(
  getValue($overBoundChild),
  20,
  'derived over bound child: recomputes on retarget'
);
relBoundChild();

// `bind` needs that same activation: a registry keyed by another bound
// control's child never gets a target unless the child is activated too, so
// nothing else here may touch `$outerItem.n` first
const outerReg = createRegistry(createAsyncControl, {
  load(handle: any, keys: any) {
    handle.setValue({ n: (keys[0] as number) * 10 });
  },
});
const chainedReg = createRegistry(createAsyncControl, {
  load(handle: any, keys: any) {
    handle.setValue(`hotel-${keys[0]}`);
  },
});
const $outerId = createPrimitiveControl(1);
const $outerItem = outerReg.bind($outerId) as any;
const $chained = chainedReg.bind($outerItem.n) as any;
const relChained = retain($chained);
await tick();
assert.equal(getValue($chained), 'hotel-10', 'bound key over bound child');
setValue($outerId, 3);
await tick();
assert.equal(
  getValue($chained),
  'hotel-30',
  'bound key over bound child: retargets'
);
relChained();

// `watchValues` subscribes through `_dependents` rather than a listener, so it
// needs the activation too - `watchValue` gets it from passing its listener
const $watchedItem = outerReg.bind(createPrimitiveControl(4)) as any;
const watchedSeen: number[] = [];
// immediate, because the value landing is where the control starts rather than
// a change to it - which is the only thing this one has to report
const unwatchBoundChild = watchValues(
  [$watchedItem.n],
  ([n]) => {
    watchedSeen.push(n as number);
  },
  true
);
const relWatched = retain($watchedItem);
await tick();
assert.deepEqual(watchedSeen, [40], 'watchValues fired for a bound child');
unwatchBoundChild();
relWatched();

// a derived whose source is itself a loadable derived: the creation-time
// source activation must not try to add a listener (no crash)
const $srcA = createAsyncControl<number>();
const $innerDerived = createAsyncDerivedControl($srcA, (v: number) => v + 1);
const $outerDerived = createDerivedControl(
  $innerDerived,
  (v: number | undefined) => v
);
const relOuter = retain($outerDerived);
setValue($srcA, 5);
await tick();
assert.equal(getValue($outerDerived), 6, 'derived over loadable derived');
relOuter();

// a bound control with an OBJECT key must resolve to the same stored control
// as `.get` with a structurally-equal object — the bound target keys by the
// same storage key as `.get`/the loader, not by object identity. Otherwise a
// value written via `.get(obj)` never reaches a control bound to a control
// that yields an equal object (e.g. a registry keyed by a derived params obj).
const objReg = createRegistry(
  createControl,
  (key: { dest: string }, page: number) => ({ n: key.dest, page })
);
const $objKey = createPrimitiveControl({ dest: 'x' });
const $objBound = objReg.bind($objKey, 0) as any;
assert.deepEqual(
  getValue($objBound),
  { n: 'x', page: 0 },
  'object-key bound initial'
);
// write through `.get` with a DIFFERENT object reference of equal content
setValue(objReg.get({ dest: 'x' }, 0), { n: 'CHANGED', page: 0 });
await tick();
assert.deepEqual(
  getValue($objBound),
  { n: 'CHANGED', page: 0 },
  'object-key bound and .get share one control for structurally-equal keys'
);

release();
rel2();
// Patch types share one node per control per lane: a queued full set has to
// survive a later path set (`buildPatchedValue` merges them), while a reload -
// which lands on the value control's node too - has to give way to one.
{
  const $o = createControl({ a: 0, b: 0 });

  setValue($o, { a: 1, b: 0 });
  setValue($o.b, 2);
  await tick();

  assert.deepEqual(
    getValue($o),
    { a: 1, b: 2 },
    'a path set must merge onto the full set queued in the same lane'
  );
}

{
  const $o = createControl({ a: 0, b: 0 });

  setValue($o.b, 2);
  setValue($o, { a: 1, b: 0 });
  await tick();

  assert.deepEqual(
    getValue($o),
    { a: 1, b: 0 },
    'a full set must drop path sets queued before it'
  );
}

// the path is routed through a node holding no value of its own, so the merge
// base for it has to come from the full set above, not from that empty node
{
  const $o = createControl({ a: 0, x: { y: 0, z: 0 } });

  setValue($o, { a: 1, x: { y: 1, z: 1 } });
  setValue($o.x.y, 9);
  await tick();

  assert.deepEqual(
    getValue($o),
    { a: 1, x: { y: 9, z: 1 } },
    'a nested path set must merge into the full set, keeping its siblings'
  );
}

{
  const $a = createAsyncControl<{ a: number; b: number }>({
    load: (handle: any) => {
      handle.setValue({ a: 0, b: 0 });
    },
  });
  const rel = retain($a);
  await tick();

  invalidate($a);
  setValue($a.b, 2);
  await tick();

  assert.deepEqual(
    getValue($a),
    { a: 0, b: 2 },
    'a path set after a reload in the same lane must commit'
  );
  rel();
}

// `isLoaded` runs once at construction against the initial value - a stale
// persisted value from an older release is enough to make it throw there, and
// that construction can happen inside a flush via a registry target
{
  const opts: any = {
    initialValue: { stale: true },
    isLoaded: (v: any) => v.items.length > 0,
  };

  const $a = createAsyncControl(opts);

  assert.deepEqual(
    getValue($a),
    { stale: true },
    'a throwing isLoaded at construction must not stop the control existing'
  );
  assert.equal(
    getValue(selectLoading($a)),
    false,
    'a thrower reads as loaded, matching checkLoading'
  );
  assert.equal(
    (reportedErrors.at(-1) as Error).message,
    "Cannot read properties of undefined (reading 'length')",
    'the throw is surfaced through reportError, not swallowed'
  );

  // the registry builds a throwaway probe control to learn its control type
  assert.ok(
    createRegistry(createAsyncControl, opts).bind(
      createPrimitiveControl<string | undefined>(undefined),
      0
    ),
    'binding must survive the type-probe construction'
  );
}

// a value arriving is where an async control starts, not a change to it
{
  const $settings = createAsyncControl<{ theme: string }>();

  const changes: string[] = [];

  const unwatchChanges = watchValue($settings, (settings) => {
    changes.push(settings!.theme);
  });

  const arrivals: string[] = [];

  const unwatchArrival = watchValue(
    $settings,
    (settings) => {
      arrivals.push(settings!.theme);
    },
    true
  );

  setValue($settings, { theme: 'dark' });
  await tick();

  assert.deepEqual(changes, [], 'the load landing is not a change');
  // immediate had nothing to be immediate about until the value was there
  assert.deepEqual(arrivals, ['dark'], 'immediate waits for the value');

  setValue($settings, { theme: 'light' });
  await tick();

  assert.deepEqual(changes, ['light'], 'an edit after it is');
  assert.deepEqual(arrivals, ['dark', 'light']);

  // already arrived: a watch started now reports changes from here on
  const later: string[] = [];

  const unwatchLater = watchValue($settings, (settings, prev) => {
    later.push(`${prev.theme}->${settings.theme}`);
  });

  setValue($settings, { theme: 'sepia' });
  await tick();

  assert.deepEqual(
    later,
    ['light->sepia'],
    'a loaded control watches as any other'
  );

  // an invalidate takes the value away and puts one back; neither the gap nor
  // the `undefined` in it is reported, and the value from before it is what the
  // one that follows is a change from
  invalidate($settings);
  await tick();

  setValue($settings, { theme: 'high-contrast' });
  await tick();

  assert.deepEqual(
    later,
    ['light->sepia', 'sepia->high-contrast'],
    'a reload is a change from the value held before it'
  );
  assert.equal(changes.length, 3, 'the cleared value reached nobody');

  // `withEmpty` is the way back to hearing every value it takes, none included
  const everything: Array<string | undefined> = [];

  const unwatchEverything = watchValue(
    $settings,
    (settings) => {
      everything.push(settings && settings.theme);
    },
    false,
    true
  );

  invalidate($settings);
  await tick();

  setValue($settings, { theme: 'dark' });
  await tick();

  assert.deepEqual(
    everything,
    [undefined, 'dark'],
    'withEmpty reports the gap and the value after it'
  );

  unwatchChanges();
  unwatchArrival();
  unwatchLater();
  unwatchEverything();
}

// watchValues reports nothing until every one of them holds a value
{
  const $a = createAsyncControl<number>();
  const $b = createAsyncControl<number>();

  const seen: Array<[number, number]> = [];

  const unwatchPair = watchValues([$a, $b], ([a, b]) => {
    seen.push([a, b]);
  });

  const immediateSeen: Array<[number, number]> = [];

  const unwatchImmediate = watchValues(
    [$a, $b],
    ([a, b]) => {
      immediateSeen.push([a, b]);
    },
    true
  );

  setValue($a, 1);
  await tick();
  setValue($a, 2);
  await tick();

  // `$b` holds nothing, so there is no tuple - what `$a` did is kept for it
  assert.deepEqual(seen, [], 'a tuple with a hole in it is not reported');
  assert.deepEqual(immediateSeen, [], 'immediate waits for every value');

  setValue($b, 10);
  await tick();

  assert.deepEqual(seen, [], 'the first full tuple is where the watch starts');
  assert.deepEqual(
    immediateSeen,
    [[2, 10]],
    'immediate is that tuple, carrying what moved while it waited'
  );

  setValue($a, 3);
  await tick();

  assert.deepEqual(seen, [[3, 10]], 'a change to a full tuple is reported');

  // and `withEmpty` hears the hole itself
  const withHoles: Array<Array<number | undefined>> = [];

  const unwatchHoles = watchValues(
    [$a, $b],
    ([a, b]) => {
      withHoles.push([a, b]);
    },
    false,
    true
  );

  invalidate($b);
  await tick();

  assert.deepEqual(
    withHoles,
    [[3, undefined]],
    'withEmpty reports a tuple with a hole in it'
  );

  unwatchPair();
  unwatchImmediate();
  unwatchHoles();
}

// a lane flushed from inside another lane's flush waits for it instead of
// committing in the middle of it
{
  const manual = createManualScheduler();

  const $nested = createControl({ y: 0 });

  const $host = createControl({ x: 0, z: 0 });

  const log: string[] = [];

  let flushed: boolean | undefined;

  let seenByX: number | undefined;

  watchValue($nested.y, (v: number) => {
    log.push(`y:${v}`);
  });

  watchValue($host.x, (v: number) => {
    log.push(`x:${v}`);

    flushed = manual.flush();

    seenByX = getValue($nested.y);
  });

  watchValue($host.z, (v: number) => {
    log.push(`z:${v}:${getValue($nested.y)}`);
  });

  setValue($nested.y, 1, manual);

  setValue($host.x, 1);
  setValue($host.z, 1);

  await tick();

  assert.equal(flushed, true, 'the pending flush is taken over, not refused');

  // both reads land before the manual lane runs, so this flush stays one commit
  // deep and nothing sees a half-applied tick
  assert.equal(seenByX, 0, 'the deferred lane has not committed yet');

  assert.deepEqual(
    log,
    ['x:1', 'z:1:0', 'y:1'],
    'the deferred lane commits after the running one, exactly once'
  );

  assert.equal(getValue($nested.y), 1, 'the deferred lane did commit');
}

// what `invalidate` returns is the reload's answer, loud or silent: the value
// still in hand until the flush is not it
{
  let n = 0;

  const $counter = createAsyncControl({
    load(handle: any) {
      handle.setValue(++n);
    },
  });

  const release = retain($counter);

  await tick();

  assert.equal(getValue($counter), 1, 'loaded');

  assert.equal(await invalidate($counter), 2, 'loud: the reloaded value');
  assert.equal(await invalidate($counter, true), 3, 'silent: the same');

  // a derived control forwards the reload to its sources - what is awaited is
  // its own recompute, even when the sources come back with what they had
  const $doubled = createAsyncDerivedControl($counter, (v: any) => v * 2);

  const releaseDoubled = retain($doubled);

  await tick();

  assert.equal(getValue($doubled), 6, 'derived computed');

  assert.equal(
    await invalidate($doubled, true),
    8,
    'derived: the promise follows the reload of its source'
  );

  const $constant = createAsyncDerivedControl($counter, () => 'same');

  const releaseConstant = retain($constant);

  await tick();

  assert.equal(
    await invalidate($constant, true),
    'same',
    'derived: a recompute landing on the value it had still settles'
  );

  release();

  releaseDoubled();

  releaseConstant();
}

console.log('core-smoke.test.ts: all assertions passed');
