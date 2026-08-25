import { tick } from './_env/dom.ts';
import assert from 'node:assert';
import test from 'node:test';
import createControl from '../src/core/createControl/index.ts';
import createPrimitiveControl from '../src/core/createPrimitiveControl/index.ts';
import createAsyncControl from '../src/core/createAsyncControl/index.ts';
import createAsyncDerivedControl from '../src/core/createAsyncDerivedControl/index.ts';
import createSnapshotControl from '../src/core/createSnapshotControl/index.ts';
import createDerivedControl from '../src/core/createDerivedControl/index.ts';
import createRegistry from '../src/core/createRegistry/index.ts';
import createBoundControl from '../src/core/createBoundControl/index.ts';
import getValue from '../src/core/getValue/index.ts';
import setValue from '../src/core/setValue/index.ts';
import retain from '../src/core/retain/index.ts';
import toPromise from '../src/core/toPromise/index.ts';
import watchValue from '../src/core/watchValue/index.ts';
import invalidate from '../src/core/invalidate/index.ts';
import watchValues from '../src/core/watchValues/index.ts';
import selectError from '../src/core/selectError/index.ts';
import noop from '../src/core/_internal/noop.ts';
import {
  actualizePending,
  cleanupScope,
} from '../src/core/_internal/cleanup.ts';
import {
  flushLane,
  getSchedulerLane,
  silentLane,
} from '../src/core/_internal/flushQueue.ts';
import { INTERNALS } from '../src/core/_internal/constants.ts';
import type { Subscription } from '../src/core/_internal/types.ts';
import type { SyncExternalStorage } from '../src/core/types.ts';

const inScope = <T>(create: () => T): [T, Subscription[]] => {
  const scope: Subscription[] = (cleanupScope._value = []);
  try {
    return [create(), scope];
  } finally {
    cleanupScope._value = null;
  }
};

/** A mount, with whatever was queued for it landed first - what a tick does. */
const pull = (control: any) => {
  const lane = getSchedulerLane();

  if (lane._maxPendingLevel) {
    flushLane(lane);
  }

  actualizePending(control[INTERNALS]._root);
};

const storageOf = (get: () => any) =>
  (() => ({ get, set: noop, observe: () => noop })) as SyncExternalStorage<any>;

test('1 storage control, read before its mount', () => {
  let stored = 1;
  const [$c] = inScope(() =>
    createControl(
      0,
      storageOf(() => stored)
    )
  );
  stored = 2;
  pull($c);
  assert.equal(getValue($c), 2);
});

test('2 storage control, its own mount is what reads it', () => {
  let stored = 1;
  const [$c, scope] = inScope(() =>
    createControl(
      0,
      storageOf(() => stored)
    )
  );
  stored = 2;
  scope[0]._subscribe();
  assert.equal(getValue($c), 2);
});

test('4 derived over a pending storage control', () => {
  let stored = 1;
  const [$c] = inScope(() =>
    createControl(
      0,
      storageOf(() => stored)
    )
  );
  const [$d] = inScope(() => createDerivedControl($c, (v: number) => v * 2));
  stored = 4;
  pull($d);
  assert.equal(getValue($c), 4, 'the source too');
  assert.equal(getValue($d), 8);
});

test('6 multi-source derived, one of them moved', () => {
  const $a = createControl(1);
  const $b = createControl(2);
  const [$sum] = inScope(() =>
    createDerivedControl($a, $b, (a: number, b: number) => a + b)
  );
  setValue($b, 10);
  pull($sum);
  assert.equal(getValue($sum), 11);
});

test('7 bound whose key moved', () => {
  const reg = createRegistry(createControl, (id: number) => ({ n: id }));
  const $key = createPrimitiveControl(1);
  const [$bound] = inScope(() => createBoundControl(reg, $key) as any);
  setValue($key, 2);
  pull($bound);
  assert.deepEqual(getValue($bound), { n: 2 });
});

test('8 bound over a pending derived key', () => {
  const reg = createRegistry(createControl, (id: number) => ({ n: id }));
  const $src = createControl(1);
  const [$key] = inScope(() => createDerivedControl($src, (v: number) => v));
  const [$bound] = inScope(() => createBoundControl(reg, $key as any) as any);
  setValue($src, 3);
  pull($bound);
  assert.deepEqual(getValue($bound), { n: 3 });
});

test('8b bound whose item moved while it was not attached to it', async () => {
  const reg = createRegistry(createControl, (id: number) => ({ n: id }));
  const $key = createPrimitiveControl(1);
  const [$bound] = inScope(() => createBoundControl(reg, $key) as any);

  // the item itself, with the keys standing still - nothing of the bound is
  // attached to it until the mount, so only the commit can see this
  setValue(reg.get(1), { n: 99 });
  await tick();

  pull($bound);
  assert.deepEqual(getValue($bound), { n: 99 });
});

test('9 derived over a pending bound', () => {
  const reg = createRegistry(createControl, (id: number) => ({ n: id }));
  const $key = createPrimitiveControl(1);
  const [$bound] = inScope(() => createBoundControl(reg, $key) as any);
  const [$d] = inScope(() =>
    createDerivedControl($bound, (v: any) => `n=${v && v.n}`)
  );
  setValue($key, 4);
  pull($d);
  assert.equal(getValue($d), 'n=4');
});

test('10 async derived over a source that moved', async () => {
  const $src = createControl(1);
  const [$d] = inScope(() =>
    createAsyncDerivedControl($src, (v: number) => v * 2)
  );
  const release = retain($d);
  await tick();
  setValue($src, 5);
  pull($d);
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
  const [$d] = inScope(() =>
    createAsyncDerivedControl($src, (v: number) => v * 2)
  );
  const release = retain($d);
  await tick();
  assert.equal(getValue($d), 2, 'it starts from the source it has');
  fail = true;
  const { default: invalidate } =
    await import('../src/core/invalidate/index.ts');
  invalidate($src);
  await tick();
  pull($d);
  assert.ok(getValue(selectError($d)), 'the error reached it');
  release();
  releaseSrc();
});

test('12 remount: cleaned up, then moved, then read', () => {
  const $src = createControl(1);
  const [$d, scope] = inScope(() =>
    createDerivedControl($src, (v: number) => v * 2)
  );
  scope[0]._subscribe();
  scope[0]._cleanup();
  setValue($src, 7);
  pull($d);
  assert.equal(getValue($d), 14);
});

test('13 remount: read, then the mount adds nothing', () => {
  const $src = createControl(1);
  const [$d, scope] = inScope(() =>
    createDerivedControl($src, (v: number) => v * 2)
  );
  scope[0]._subscribe();
  scope[0]._cleanup();
  setValue($src, 7);
  pull($d);
  scope[0]._subscribe();
  assert.equal(getValue($d), 14);
  assert.equal(($src[INTERNALS]._root as any)._dependents.length, 1);
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
  const [$bound, scope] = inScope(() => createBoundControl(reg, $key) as any);
  scope[0]._subscribe();
  const release = retain($bound);
  await tick();
  assert.deepEqual(getValue($bound), { n: 1 });
  scope[0]._cleanup();
  setValue($key, 2);
  pull($bound);
  // keepPrev covers a live retarget; across a remount there is no target to
  // hold on to, so it reports nothing until the new item lands
  assert.equal(getValue($bound), undefined);
  await tick();
  assert.deepEqual(getValue($bound), { n: 2 });
  release();
});

test('15 a snapshot control that is done is never resynced', async () => {
  const $src = createControl(1);
  const [$d, scope] = inScope(() =>
    createSnapshotControl($src, (v: number) => v * 2)
  );
  const release = retain($d);
  await tick();
  assert.equal(getValue($d), 2);
  setValue($src, 5);
  await tick();
  pull($d);
  assert.equal(getValue($d), 2, 'once means once');
  assert.equal(scope.length, 0, 'and it never registered');
  release();
});

test('16 toPromise answers with what the control holds, mounted or not', async () => {
  const $src = createControl(1);
  const [$d, scope] = inScope(() =>
    createAsyncDerivedControl($src, (v: number) => v * 2)
  );
  const release = retain($d);
  await tick();
  assert.equal(getValue($d), 2);

  setValue($src, 5);

  await tick();

  // nothing mounted it, so it heard nothing of that - and a read is no mount
  assert.equal(await toPromise($d), 2);

  scope[0]._subscribe();

  assert.equal(await toPromise($d), 10, 'which the mount is what changes');
  release();
});

test('17 a watch catches nothing up - the mount is what does', async () => {
  const $src = createControl(1);

  const [$a, scopeA] = inScope(() =>
    createDerivedControl($src, (v: number) => `a${v}`)
  );

  scopeA[0]._subscribe();

  const [$b, scopeB] = inScope(() =>
    createDerivedControl($src, (v: number) => `b${v}`)
  );

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

  scopeB[0]._subscribe();

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
  const [$d, scope] = inScope(() =>
    createDerivedControl($src, (v: number) => v * 2)
  );

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

  scope[0]._subscribe();

  assert.equal(getValue($d), 10, 'caught up');
  assert.deepEqual(heard, [], 'and left the queue where it was');

  await tick();

  assert.deepEqual(heard, ['b'], 'which the scheduled flush still gets to');

  stop();
});

test('20 a catch-up with nothing moved recomputes nothing', () => {
  const $src = createControl(1);

  let calls = 0;

  const [$d, scope] = inScope(() =>
    createDerivedControl($src, (v: number) => {
      calls++;

      return { n: v };
    })
  );

  scope[0]._subscribe();

  scope[0]._cleanup();

  pull($d);

  const settled = calls;

  const value = getValue($d);

  scope[0]._subscribe();

  scope[0]._cleanup();

  pull($d);

  assert.equal(calls, settled, 'the sources read the same, so nothing ran');
  assert.equal(getValue($d), value, 'and it is holding the same object');
});

test('21 a bound catch-up tells nobody either', async () => {
  const reg = createRegistry(createControl, (id: number) => ({ n: id }));

  const $key = createPrimitiveControl(1);

  const [$bound, scope] = inScope(() => createBoundControl(reg, $key) as any);

  // the item moved with nothing of the bound attached to it
  setValue(reg.get(1), { n: 99 });

  await tick();

  const heard: any[] = [];

  const stop = watchValue($bound, (value: any) => {
    heard.push(value);
  });

  scope[0]._subscribe();

  assert.deepEqual(getValue($bound), { n: 99 }, 'the mount took it');
  assert.deepEqual(heard, [], 'and told nobody it did');

  stop();
});

test('22 a storage catch-up keeps the object it already had', () => {
  const stored = { name: 'jane' };

  // what a JSON-backed storage does: every read is a new object
  const [$c, scope] = inScope(() =>
    createControl(undefined, (() => ({
      get: () => ({ ...stored }),
      set: noop,
      observe: () => noop,
    })) as SyncExternalStorage<any>)
  );

  const first = getValue($c);

  scope[0]._subscribe();

  assert.deepEqual(getValue($c), { name: 'jane' });
  assert.equal(getValue($c), first, 'nothing moved, so nothing was replaced');
});

test('23 a derived catch-up keeps the object it already had', async () => {
  const $src = createControl({ user: { name: 'jane' }, other: 1 });

  const [$d, scope] = inScope(() =>
    createDerivedControl($src, (v: any) => ({ name: v.user.name }))
  );

  const first = getValue($d);

  // the source moved, what this derives from it did not
  setValue($src, { user: { name: 'jane' }, other: 2 });

  await tick();

  scope[0]._subscribe();

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

  const [$inner, innerScope] = inScope(() =>
    createAsyncDerivedControl($src, (v: number) => v * 2)
  );

  const [$outer, scope] = inScope(() =>
    createAsyncDerivedControl($inner as any, (v: number) => v + 1)
  );

  const release = retain($outer);

  innerScope[0]._subscribe();

  scope[0]._subscribe();

  handle.setValue(1);

  await tick();

  assert.equal(getValue($outer), 3);

  // both let go, so what the reload brings reaches neither of them
  innerScope[0]._cleanup();

  scope[0]._cleanup();

  invalidate($src);

  await tick();

  handle.setError(new Error('nope'));

  await tick();

  scope[0]._subscribe();

  assert.ok(
    getValue(selectError($outer)),
    'the one in the middle was caught up with before its error was read'
  );

  release();
});

// last in the file, so every catch-up above it is what this is asserted after
test('25 nothing of every catch-up above is left on the silent lane', () => {
  const levels = silentLane._pendingControlLevels;

  let queued = 0;

  for (let i = 0; i < levels.length; i++) {
    const level = levels[i];

    if (level) {
      queued += level.length;
    }
  }

  // a lane nothing ever flushes is one nothing may land on: what did would be
  // an update lost and held on to at once
  assert.equal(queued, 0, 'no control was queued on it');
  assert.equal(silentLane._patchByControl.size, 0, 'and no patch');
  assert.equal(silentLane._beforeFlushHooks.length, 0);
  assert.equal(silentLane._minPendingLevel, Infinity);
  assert.equal(silentLane._maxPendingLevel, 0);
});
