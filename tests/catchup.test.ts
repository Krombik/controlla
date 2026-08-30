import { tick } from './_env/dom.ts';
import assert from 'node:assert';
import test from 'node:test';
import createControl from '../build/core/createControl/index.js';
import createPrimitiveControl from '../build/core/createPrimitiveControl/index.js';
import createAsyncControl from '../build/core/createAsyncControl/index.js';
import createDerivedControl from '../build/core/createDerivedControl/index.js';
import createAsyncDerivedControl from '../build/core/createAsyncDerivedControl/index.js';
import createRegistry from '../build/core/createRegistry/index.js';
import createBoundControl from '../build/core/createBoundControl/index.js';
import getValue from '../build/core/getValue/index.js';
import setValue from '../build/core/setValue/index.js';
import retain from '../build/core/retain/index.js';
import watchValue from '../build/core/watchValue/index.js';
import selectError from '../build/core/selectError/index.js';
import type { SyncExternalStorage } from '../build/core/types.js';

const noop = () => {};

/**
 * The same graph twice: one watched from the start, one left unwatched until
 * after everything has moved. Whatever the second one reads once it is
 * watched, the first one reads too - that is the whole of a catch-up.
 *
 * `watchValue` is what a mount looks like from outside: it is the subscription
 * a rendered `useValue` opens, and the function it hands back is the unmount.
 */
const agree = async (
  name: string,
  create: () => any,
  move: () => void,
  read: (control: any) => any = getValue,
  rewatch = false
) => {
  const mounted = create();

  const late = create();

  const releases = [watchValue(mounted, noop), retain(mounted), retain(late)];

  // a remount: watched once, let go, and watched again after the move
  const unwatchFirst = rewatch ? watchValue(late, noop) : undefined;

  await tick();

  if (unwatchFirst) {
    unwatchFirst();
  }

  move();

  await tick();

  const unwatchLate = watchValue(late, noop);

  assert.deepEqual(read(late), read(mounted), name);

  unwatchLate();

  for (let i = 0; i < releases.length; i++) {
    releases[i]();
  }
};

test('a late mount lands where a mounted one already is', async () => {
  const $src = createControl({ n: 1 });

  await agree(
    'derived',
    () => createDerivedControl($src, (v: any) => v.n * 2),
    () => setValue($src, { n: 5 })
  );

  await agree(
    'derived over derived',
    () =>
      createDerivedControl(
        createDerivedControl($src, (v: any) => v.n + 1),
        (v: any) => v * 10
      ),
    () => setValue($src, { n: 7 })
  );

  const $other = createPrimitiveControl(3);

  await agree(
    'multi-source derived',
    () => createDerivedControl($src, $other, (a: any, b: any) => a.n + b),
    () => {
      setValue($src, { n: 11 });

      setValue($other, 4);
    }
  );

  let stored: any = { n: 1 };

  const watchers: Array<(value: any) => void> = [];

  // a storage that tells whoever observes it, so the mounted one hears the
  // write and the detached one has to read it back
  const storage: SyncExternalStorage<any> = () => ({
    get: () => stored,
    set: (value) => {
      stored = value;
    },
    observe: (listener: any) => {
      watchers.push(listener);

      return noop;
    },
  });

  await agree(
    'derived over a storage control',
    () =>
      createDerivedControl(
        createControl(undefined, storage),
        (v: any) => v && v.n * 3
      ),
    () => {
      stored = { n: 9 };

      for (let i = 0; i < watchers.length; i++) {
        watchers[i](stored);
      }
    }
  );

  const reg = createRegistry(createControl, (id: number) => ({ n: id }));

  const $key = createPrimitiveControl(1);

  await agree(
    'bound over a key control',
    () => createBoundControl(reg, $key),
    () => setValue($key, 4)
  );

  await agree(
    'derived over a bound',
    () =>
      createDerivedControl(createBoundControl(reg, $key) as any, (v: any) =>
        v ? `n=${v.n}` : 'none'
      ),
    () => setValue($key, 6)
  );
});

test('a late mount lands on the same error a mounted one has', async () => {
  const handles: any[] = [];

  const $src: any = createAsyncControl<number>({
    load(h: any) {
      handles.push(h);
    },
  });

  await agree(
    'async derived error',
    () => createAsyncDerivedControl($src, (v: number) => v * 2),
    () => {
      for (let i = 0; i < handles.length; i++) {
        handles[i].setError(new Error('nope'));
      }
    },
    (control) => !!getValue(selectError(control))
  );
});

test('a remount lands where one that never let go already is', async () => {
  const $src = createControl({ n: 1 });

  await agree(
    'derived',
    () => createDerivedControl($src, (v: any) => v.n * 2),
    () => setValue($src, { n: 5 }),
    getValue,
    true
  );

  await agree(
    'derived over derived',
    () =>
      createDerivedControl(
        createDerivedControl($src, (v: any) => v.n + 1),
        (v: any) => v * 10
      ),
    () => setValue($src, { n: 7 }),
    getValue,
    true
  );

  const reg = createRegistry(createControl, (id: number) => ({ n: id }));

  const $key = createPrimitiveControl(1);

  await agree(
    'bound over a key control',
    () => createBoundControl(reg, $key),
    () => setValue($key, 4),
    getValue,
    true
  );

  await agree(
    'bound whose item moved',
    () => createBoundControl(reg, $key),
    () => setValue(reg.get(4), { n: 99 }),
    getValue,
    true
  );
});
