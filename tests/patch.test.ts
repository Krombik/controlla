// the env module must come first: it installs the browser mocks
import { tick } from './_env/dom.ts';
import assert from 'node:assert';

const { default: createControl } =
  await import('../build/core/createControl/index.js');
import setValue from '../build/core/setValue/index.js';
import getValue from '../build/core/getValue/index.js';
import watchValue from '../build/core/watchValue/index.js';

// granular: sibling listener must not fire
const $u = createControl({ a: { x: 1, y: 2 }, b: 3 });
const log: any[] = [];
watchValue($u.a.x, (v: any, p: any) => {
  log.push(['x', v, p]);
});
watchValue($u.a.y, (v: any, p: any) => {
  log.push(['y', v, p]);
});
watchValue($u.b, (v: any, p: any) => {
  log.push(['b', v, p]);
});
watchValue($u, () => {
  log.push(['root']);
});

setValue($u.a.x, 10);
await tick();
assert.deepEqual(log, [['x', 10, 1], ['root']], 'only x + root fire');
log.length = 0;

// whole-object set: same values -> no notifications
setValue($u, { a: { x: 10, y: 2 }, b: 3 });
await tick();
assert.deepEqual(log, [], 'deep-equal set is silent');

// whole-object set: y changes
setValue($u, { a: { x: 10, y: 20 }, b: 3 });
await tick();
assert.deepEqual(log, [['y', 20, 2], ['root']], 'only y + root');
log.length = 0;

// added / removed keys
const $o = createControl<{ p: number; q?: number }>({ p: 1 });
const olog: any[] = [];
watchValue($o.q, (v, p) => {
  olog.push(['q', v, p]);
});
setValue($o, { p: 1, q: 5 });
await tick();
assert.deepEqual(olog, [['q', 5, undefined]], 'added key notifies child');
setValue($o, { p: 1 });
await tick();
assert.deepEqual(
  olog,
  [
    ['q', 5, undefined],
    ['q', undefined, 5],
  ],
  'removed key notifies child'
);

// array shrink with per-index listener
const $arr = createControl([1, 2, 3]);
const alog: any[] = [];
watchValue($arr[2], (v, p) => {
  alog.push([v, p]);
});
setValue($arr, [1, 2]);
await tick();
assert.deepEqual(alog, [[undefined, 3]], 'removed index notifies');
assert.deepEqual(getValue($arr), [1, 2]);

// array shrink with NO children (crash guard / early-return path)
const $arr2 = createControl<number[]>([1, 2, 3]);
setValue($arr2, [1]);
await tick();
assert.deepEqual(getValue($arr2), [1], 'shrink without children');

// prototype swap: object -> array, nested child sees disappearance
const $m = createControl<{ list: Record<string, string> }>({
  list: { '0': 'a' },
});
const mlog: any[] = [];
watchValue($m.list['0'], (v, p) => {
  mlog.push([v, p]);
});
// intentionally off-type: the runtime must survive an object -> array swap
setValue($m, { list: ['b'] as unknown as Record<string, string> });
await tick();
assert.deepEqual(mlog, [['b', 'a']], 'proto swap diffs child key');

// nested patch: two sibling paths in one flush (commitPatchNode dedupe)
const $n = createControl({ a: 1, b: 2, c: 3 });
setValue($n.a, 10);
setValue($n.c, 30);
await tick();
assert.deepEqual(getValue($n), { a: 10, b: 2, c: 30 }, 'multi-key patch');

// date compare
const $d = createControl({ t: new Date(1000) });
const dlog: any[] = [];
watchValue($d.t, () => {
  dlog.push(1);
});
setValue($d, { t: new Date(1000) });
await tick();
assert.equal(dlog.length, 0, 'equal dates silent');
setValue($d, { t: new Date(2000) });
await tick();
assert.equal(dlog.length, 1, 'changed date notifies');

// subtree appear/vanish notifies listened descendants (notifyDescendants)
const $t = createControl<any>(null);
const tlog: any[] = [];
watchValue($t.a.b, (v: any, p: any) => {
  tlog.push([v, p]);
});
setValue($t, { a: { b: 5 } }); // primitive -> object: subtree appears
await tick();
assert.deepEqual(
  tlog.at(-1),
  [5, undefined],
  'nested listener on subtree appear'
);
setValue($t, null); // object -> primitive: subtree vanishes
await tick();
assert.deepEqual(
  tlog.at(-1),
  [undefined, 5],
  'nested listener on subtree vanish'
);

// NaN re-set is the same input arriving twice, at the root and on a path
const $nan = createControl({ a: NaN });
const nlog: any[] = [];
watchValue($nan.a, () => {
  nlog.push(1);
});
setValue($nan.a, NaN);
await tick();
assert.equal(nlog.length, 0, 'NaN over NaN on a path does not notify');
setValue($nan, { a: NaN });
await tick();
assert.equal(nlog.length, 0, 'NaN over NaN at the root does not notify');
setValue($nan.a, 1);
await tick();
assert.equal(nlog.length, 1, 'leaving NaN notifies');

// a listener reads the value its change is part of, not the one it replaced
const $c = createControl({ a: { x: 1 }, b: 2 });
let seenSelf: any;
let seenRoot: any;
watchValue($c.a.x, () => {
  seenSelf = getValue($c.a.x);
  seenRoot = getValue($c);
});
setValue($c.a.x, 5);
await tick();
assert.equal(seenSelf, 5, 'the changed path reads as committed');
assert.deepEqual(
  seenRoot,
  { a: { x: 5 }, b: 2 },
  'the root reads as committed'
);

// the same for a whole-value set, which is in place before the diff even runs
const $w = createControl({ a: { x: 1 }, b: 2 });
let wSelf: any;
let wRoot: any;
watchValue($w.a.x, () => {
  wSelf = getValue($w.a.x);
  wRoot = getValue($w);
});
setValue($w, { a: { x: 9 }, b: 2 });
await tick();
assert.equal(wSelf, 9, 'the changed path reads as committed');
assert.deepEqual(wRoot, { a: { x: 9 }, b: 2 }, 'the root reads as committed');

// a set that changes nothing must leave the value it rolled back untouched
const before = getValue($w);
setValue($w, { a: { x: 9 }, b: 2 });
await tick();
assert.equal(
  getValue($w),
  before,
  'an unchanged set keeps the committed value'
);

console.log('patch-smoke.test.ts: all assertions passed');
