import { tick } from './_env/dom.ts';
import assert from 'node:assert';
import test from 'node:test';
import createControl from '../src/core/createControl/index.ts';
import createPrimitiveControl from '../src/core/createPrimitiveControl/index.ts';
import createAsyncControl from '../src/core/createAsyncControl/index.ts';
import createDerivedControl from '../src/core/createDerivedControl/index.ts';
import createAsyncDerivedControl from '../src/core/createAsyncDerivedControl/index.ts';
import createRegistry from '../src/core/createRegistry/index.ts';
import createBoundControl from '../src/core/createBoundControl/index.ts';
import getValue from '../src/core/getValue/index.ts';
import setValue from '../src/core/setValue/index.ts';
import retain from '../src/core/retain/index.ts';
import selectError from '../src/core/selectError/index.ts';
import noop from '../src/core/_internal/noop.ts';
import { cleanupScope } from '../src/core/_internal/cleanup.ts';
import type { Subscription } from '../src/core/_internal/types.ts';
import type { SyncExternalStorage } from '../src/core/types.ts';

const build = <T>(create: () => T) => {
  const scope: Subscription[] = (cleanupScope._value = []);

  try {
    return [create(), scope] as const;
  } finally {
    cleanupScope._value = null;
  }
};

const mount = (scope: Subscription[]) => {
  for (let i = 0; i < scope.length; i++) {
    scope[i]._subscribe();
  }
};

/**
 * The same graph twice: one mounted from the start, one left detached until
 * after everything has moved. Whatever the second one is holding once it
 * mounts, the first one is holding too - that is the whole of a catch-up.
 */
const agree = async (
  name: string,
  create: () => any,
  move: () => void,
  read: (control: any) => any = getValue,
  remount = false
) => {
  const [mounted, mountedScope] = build(create);

  mount(mountedScope);

  const [late, lateScope] = build(create);

  const releases = [retain(mounted), retain(late)];

  if (remount) {
    mount(lateScope);
  }

  await tick();

  if (remount) {
    for (let i = 0; i < lateScope.length; i++) {
      lateScope[i]._cleanup();
    }
  }

  move();

  await tick();

  mount(lateScope);

  assert.deepEqual(read(late), read(mounted), name);

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
