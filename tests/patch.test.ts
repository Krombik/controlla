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

console.log('patch-smoke.test.ts: all assertions passed');
