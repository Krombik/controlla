import { tick } from './_env/dom.ts';
import assert from 'node:assert';
import test from 'node:test';
import createControl from '../build/core/createControl/index.js';
import createPrimitiveControl from '../build/core/createPrimitiveControl/index.js';
import createAsyncControl from '../build/core/createAsyncControl/index.js';
import createRegistry from '../build/core/createRegistry/index.js';
import getValue from '../build/core/getValue/index.js';
import setValue from '../build/core/setValue/index.js';
import retain from '../build/core/retain/index.js';
import toPromise from '../build/core/toPromise/index.js';
import watchValue from '../build/core/watchValue/index.js';
import invalidate from '../build/core/invalidate/index.js';
import watchValues from '../build/core/watchValues/index.js';
import selectError from '../build/core/selectError/index.js';
import useControl from '../build/core/useControl/index.js';
import useDerivedControl from '../build/core/useDerivedControl/index.js';
import useAsyncDerivedControl from '../build/core/useAsyncDerivedControl/index.js';
import useSnapshotControl from '../build/core/useSnapshotControl/index.js';
import useBoundControl from '../build/core/useBoundControl/index.js';
import { renderHook } from './_env/hooks.ts';
import type { SyncExternalStorage } from '../build/core/types.js';

const noop = () => {};

/**
 * What every case here starts from: a tree that has let go of its controls.
 *
 * Everything one hook creates mounts and unmounts in a single commit, the way
 * a component's do - so a source and what derives from it are never attached
 * on their own. Detached, each of them owes a catch-up; the mount is what
 * pays it, and these are the ways that can go.
 */
const detached = <T>(use: () => T) => {
  const rendered = renderHook(use);

  rendered.unmount();

  return rendered;
};

const storageOf = (get: () => any) =>
  (() => ({ get, set: noop, observe: () => noop })) as SyncExternalStorage<any>;

test('1 storage control, read on its mount', async () => {
  let stored = 1;
  const r = detached(() =>
    useControl(
      0,
      storageOf(() => stored)
    )
  );
  stored = 2;
  r.remount();
  assert.equal(getValue(r.result), 2);
});

test('2 storage control, nothing reads it until that mount', async () => {
  let stored = 1;
  const r = detached(() =>
    useControl(
      0,
      storageOf(() => stored)
    )
  );
  stored = 2;
  assert.equal(getValue(r.result), 1, 'detached, it holds what it had');
  r.remount();
  assert.equal(getValue(r.result), 2);
});

test('4 derived over a pending storage control', async () => {
  let stored = 1;
  const r = detached(() => {
    const $c = useControl(
      0,
      storageOf(() => stored)
    );
    return [$c, useDerivedControl($c, (v: number) => v * 2)] as const;
  });
  stored = 4;
  r.remount();
  const [$c, $d] = r.result;
  assert.equal(getValue($c), 4, 'the source too');
  assert.equal(getValue($d), 8);
});

test('6 multi-source derived, one of them moved', async () => {
  const $a = createControl(1);
  const $b = createControl(2);
  const r = detached(() =>
    useDerivedControl($a, $b, (a: number, b: number) => a + b)
  );
  setValue($b, 10);
  await tick();
  r.remount();
  assert.equal(getValue(r.result), 11);
});

test('7 bound whose key moved', async () => {
  const reg = createRegistry(createControl, (id: number) => ({ n: id }));
  const $key = createPrimitiveControl(1);
  const r = detached(() => useBoundControl(reg)($key) as any);
  setValue($key, 2);
  await tick();
  r.remount();
  assert.deepEqual(getValue(r.result), { n: 2 });
});

test('8 bound over a pending derived key', async () => {
  const reg = createRegistry(createControl, (id: number) => ({ n: id }));
  const $src = createControl(1);
  const r = detached(() => {
    const $key = useDerivedControl($src, (v: number) => v);
    return useBoundControl(reg)($key as any) as any;
  });
  setValue($src, 3);
  await tick();
  r.remount();
  assert.deepEqual(getValue(r.result), { n: 3 });
});

test('8b bound whose item moved while it was not attached to it', async () => {
  const reg = createRegistry(createControl, (id: number) => ({ n: id }));
  const $key = createPrimitiveControl(1);
  const r = detached(() => useBoundControl(reg)($key) as any);

  // the item itself, with the keys standing still - nothing of the bound is
  // attached to it while the tree has let go, so only the mount can see this
  setValue(reg.get(1), { n: 99 });
  await tick();

  r.remount();
  assert.deepEqual(getValue(r.result), { n: 99 });
});

test('9 derived over a pending bound', async () => {
  const reg = createRegistry(createControl, (id: number) => ({ n: id }));
  const $key = createPrimitiveControl(1);
  const r = detached(() => {
    const $bound = useBoundControl(reg)($key) as any;
    return useDerivedControl($bound, (v: any) => `n=${v && v.n}`);
  });
  setValue($key, 4);
  await tick();
  r.remount();
  assert.equal(getValue(r.result), 'n=4');
});

test('10 async derived over a source that moved', async () => {
  const $src = createControl(1);
  const r = detached(() => useAsyncDerivedControl($src, (v: number) => v * 2));
  const $d = r.result;
  const release = retain($d);
  await tick();
  setValue($src, 5);
  await tick();
  r.remount();
  assert.equal(getValue($d), 10);
  release();
});

test('11 async derived whose source errored while it was detached', async () => {
  let fail = false;
  const $src: any = createAsyncControl<number>({
    load(handle) {
      if (fail) {
        handle.setError(new Error('nope'));
      } else {
        handle.setValue(1);
      }
    },
  });
  const releaseSrc = retain($src);
  await tick();
  const r = detached(() => useAsyncDerivedControl($src, (v: number) => v * 2));
  const $d = r.result;
  const release = retain($d);
  await tick();
  assert.equal(getValue($d), 2, 'it starts from the source it has');
  fail = true;
  const { default: invalidate } =
    await import('../build/core/invalidate/index.js');
  invalidate($src);
  await tick();
  r.remount();
  assert.ok(getValue(selectError($d)), 'the error reached it');
  release();
  releaseSrc();
});

test('12 remount: let go of, then moved, then read', async () => {
  const $src = createControl(1);
  const r = detached(() => useDerivedControl($src, (v: number) => v * 2));
  setValue($src, 7);
  await tick();
  r.remount();
  assert.equal(getValue(r.result), 14);
});

test('13 remount: read, then the mount adds nothing', async () => {
  const $src = createControl(1);
  let computes = 0;
  const r = detached(() =>
    useDerivedControl($src, (v: number) => {
      computes++;
      return v * 2;
    })
  );
  setValue($src, 7);
  await tick();
  r.remount();
  assert.equal(getValue(r.result), 14);

  // a second subscription would make the next write arrive twice
  computes = 0;
  setValue($src, 9);
  await tick();
  assert.equal(getValue(r.result), 18);
  assert.equal(computes, 1, 'the mount left one follower, not two');
});

test('14 bound remount with keepPrev, key moved to an unloaded item', async () => {
  const reg = createRegistry(
    createAsyncControl,
    {
      load(handle: any, keys: any) {
        Promise.resolve().then(() => handle.setValue({ n: keys[0] }));
      },
    },
    { keepPrev: true }
  );
  const $key = createPrimitiveControl(1);
  const r = detached(() => useBoundControl(reg)($key) as any);
  const $bound = r.result;
  r.remount();
  const release = retain($bound);
  await tick();
  assert.deepEqual(getValue($bound), { n: 1 });
  r.unmount();
  setValue($key, 2);
  await tick();
  r.remount();
  // keepPrev covers a live retarget; across a remount there is no target to
  // hold on to, so it reports nothing until the new item lands
  assert.equal(getValue($bound), undefined);
  await tick();
  assert.deepEqual(getValue($bound), { n: 2 });
  release();
});

test('15 a snapshot control that is done is never resynced', async () => {
  const $src = createControl(1);
  const rd = detached(() => useSnapshotControl($src, (v: number) => v * 2));
  const $d = rd.result;
  const release = retain($d);
  await tick();
  assert.equal(getValue($d), 2);
  setValue($src, 5);
  await tick();
  rd.remount();
  assert.equal(getValue($d), 2, 'once means once');
  release();
});

test('16 toPromise answers with what the control holds, mounted or not', async () => {
  const $src = createControl(1);
  const rd = detached(() => useAsyncDerivedControl($src, (v: number) => v * 2));
  const $d = rd.result;
  const release = retain($d);
  await tick();
  assert.equal(getValue($d), 2);

  setValue($src, 5);

  await tick();

  // nothing mounted it, so it heard nothing of that - and a read is no mount
  assert.equal(await toPromise($d), 2);

  rd.remount();

  assert.equal(await toPromise($d), 10, 'which the mount is what changes');
  release();
});

test('17 a watch catches nothing up - the mount is what does', async () => {
  const $src = createControl(1);

  const ra = detached(() => useDerivedControl($src, (v: number) => `a${v}`));
  const $a = ra.result;

  ra.remount();

  const rb = detached(() => useDerivedControl($src, (v: number) => `b${v}`));
  const $b = rb.result;

  // the mounted one hears it, the other one is nobody's to tell
  setValue($src, 9);

  await tick();

  const calls: any[][] = [];

  const stop = watchValues([$a, $b] as any, (values: any) => {
    calls.push(values.slice());
  });

  assert.deepEqual(
    [getValue($a), getValue($b)],
    ['a9', 'b1'],
    'a watch is not a mount'
  );

  rb.remount();

  assert.equal(getValue($b), 'b9', 'the mount takes it');

  // a catch-up notifies nothing: it runs where a listener of that commit is not
  // attached yet, and this one predates the whole commit
  assert.deepEqual(calls, []);

  setValue($src, 10);

  await tick();

  assert.deepEqual(calls, [['a10', 'b10']], 'what moves after it is a change');

  stop();
});

test('18 the tuple a watch opens with is what its first change is from', async () => {
  const $a = createControl('a');
  const $b = createControl(1);

  const seen: any[][] = [];

  const stop = watchValues([$a, $b] as any, (values: any, prev: any) => {
    seen.push([values.slice(), prev.slice()]);
  });

  setValue($a, 'b');

  await tick();

  assert.deepEqual(seen, [
    [
      ['b', 1],
      ['a', 1],
    ],
  ]);

  stop();
});

test('19 a catch-up drains nothing the user queued', async () => {
  const $src = createControl(1);
  const rd = detached(() => useDerivedControl($src, (v: number) => v * 2));
  const $d = rd.result;

  setValue($src, 5);

  await tick();

  const $other = createControl('a');

  const heard: string[] = [];

  const stop = watchValue($other, (value: any) => {
    heard.push(value);
  });

  // queued, and nothing of it is the catch-up's business - a mount runs while
  // React refuses a rerender, and this one has a listener that would ask for it
  setValue($other, 'b');

  rd.remount();

  assert.equal(getValue($d), 10, 'caught up');
  assert.deepEqual(heard, [], 'and left the queue where it was');

  await tick();

  assert.deepEqual(heard, ['b'], 'which the scheduled flush still gets to');

  stop();
});

test('20 a catch-up with nothing moved recomputes nothing', async () => {
  const $src = createControl(1);

  let calls = 0;

  const rd = detached(() =>
    useDerivedControl($src, (v: number) => {
      calls++;

      return { n: v };
    })
  );
  const $d = rd.result;

  rd.remount();

  rd.unmount();

  rd.remount();

  const settled = calls;

  const value = getValue($d);

  rd.remount();

  rd.unmount();

  rd.remount();

  assert.equal(calls, settled, 'the sources read the same, so nothing ran');
  assert.equal(getValue($d), value, 'and it is holding the same object');
});

test('21 a bound catch-up tells nobody either', async () => {
  const reg = createRegistry(createControl, (id: number) => ({ n: id }));

  const $key = createPrimitiveControl(1);

  const rbound = detached(() => useBoundControl(reg)($key) as any);
  const $bound = rbound.result;

  // the item moved with nothing of the bound attached to it
  setValue(reg.get(1), { n: 99 });

  await tick();

  const heard: any[] = [];

  const stop = watchValue($bound, (value: any) => {
    heard.push(value);
  });

  rbound.remount();

  assert.deepEqual(getValue($bound), { n: 99 }, 'the mount took it');
  assert.deepEqual(heard, [], 'and told nobody it did');

  stop();
});

test('22 a storage catch-up keeps the object it already had', async () => {
  const stored = { name: 'jane' };

  // what a JSON-backed storage does: every read is a new object
  const rc = detached(() =>
    useControl(undefined, (() => ({
      get: () => ({ ...stored }),
      set: noop,
      observe: () => noop,
    })) as SyncExternalStorage<any>)
  );
  const $c = rc.result;

  const first = getValue($c);

  rc.remount();

  assert.deepEqual(getValue($c), { name: 'jane' });
  assert.equal(getValue($c), first, 'nothing moved, so nothing was replaced');
});

test('23 a derived catch-up keeps the object it already had', async () => {
  const $src = createControl({ user: { name: 'jane' }, other: 1 });

  const rd = detached(() =>
    useDerivedControl($src, (v: any) => ({ name: v.user.name }))
  );
  const $d = rd.result;

  const first = getValue($d);

  // the source moved, what this derives from it did not
  setValue($src, { user: { name: 'jane' }, other: 2 });

  await tick();

  rd.remount();

  assert.deepEqual(getValue($d), { name: 'jane' });
  assert.equal(getValue($d), first, 'so nothing of it was replaced');
});

test('24 a chain catches its sources up before it reads their errors', async () => {
  let handle: any;

  const $src: any = createAsyncControl<number>({
    load(h: any) {
      handle = h;
    },
  });

  const rinner = detached(() =>
    useAsyncDerivedControl($src, (v: number) => v * 2)
  );
  const $inner = rinner.result;

  const router = detached(() =>
    useAsyncDerivedControl($inner as any, (v: number) => v + 1)
  );
  const $outer = router.result;

  const release = retain($outer);

  rinner.remount();

  router.remount();

  handle.setValue(1);

  await tick();

  assert.equal(getValue($outer), 3);

  // both let go, so what the reload brings reaches neither of them
  rinner.unmount();

  router.unmount();

  invalidate($src);

  await tick();

  handle.setError(new Error('nope'));

  await tick();

  router.remount();

  assert.ok(
    getValue(selectError($outer)),
    'the one in the middle was caught up with before its error was read'
  );

  release();
});
