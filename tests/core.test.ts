// the env module must come first: it installs the browser mocks
import { tick } from './_env/dom.ts';
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
const { default: createRegistry } =
  await import('../build/core/createRegistry/index.js');
import setValue from '../build/core/setValue/index.js';
import getValue from '../build/core/getValue/index.js';
const { default: invalidate } =
  await import('../build/core/invalidate/index.js');
const { default: selectLoading } =
  await import('../build/core/selectLoading/index.js');
const { default: watchValue } =
  await import('../build/core/watchValue/index.js');
import retain from '../build/core/retain/index.js';

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
invalidate($async, true); // silent: keeps value while reloading
// before the flush commits, value must persist; after reload -> 300
await tick();
assert.equal(getValue($async), 300, 'silent invalidate reloaded');
assert.equal(fetchCount, 3);

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
assert.equal(getValue($async2), 1, 'silent: value kept while reloading');
assert.equal(getValue(selectLoading($async2)), true, 'silent: loading again');
resolveNext(2);
await tick();
assert.equal(getValue($async2), 2, 'silent: new value committed');

// registry get/bind/delete (_bound/_initArg/_holdingPrev renames)
const reg = createRegistry(createControl, (id: number) => `item-${id}`);
assert.equal(getValue(reg.get(1)), 'item-1');
assert.equal(reg.get(1), reg.get(1), 'cached');
const $key = createPrimitiveControl(1);
const $bound = reg.bind($key);
assert.equal(getValue($bound), 'item-1', 'bound initial');
setValue($key, 2);
await tick();
assert.equal(getValue($bound), 'item-2', 'bound retarget');
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

release();
rel2();
console.log('core-smoke.test.ts: all assertions passed');
