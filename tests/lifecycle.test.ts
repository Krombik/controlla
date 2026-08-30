// the env module must come first: it installs the browser mocks
import { tick, reportedErrors } from './_env/dom.ts';
import assert from 'node:assert';
import test from 'node:test';

import createControl from '../build/core/createControl/index.js';
import createAsyncControl from '../build/core/createAsyncControl/index.js';
import createPrimitiveControl from '../build/core/createPrimitiveControl/index.js';
import createRegistry from '../build/core/createRegistry/index.js';
import createBoundControl from '../build/core/createBoundControl/index.js';
import useBoundControl from '../build/core/useBoundControl/index.js';
import createDerivedControl from '../build/core/createDerivedControl/index.js';
import useControl from '../build/core/useControl/index.js';
import useDerivedControl from '../build/core/useDerivedControl/index.js';
import getValue from '../build/core/getValue/index.js';
import watchValue from '../build/core/watchValue/index.js';
import selectLoading from '../build/core/selectLoading/index.js';
import retain from '../build/core/retain/index.js';
import useValue from '../build/core/useValue/index.js';
import setValue from '../build/core/setValue/index.js';
import { renderHook } from './_env/hooks.ts';
import type { SyncExternalStorage } from '../build/core/types.js';

const noop = () => {};

/**
 * Nothing counts subscribers from outside. What stands in for it: a control
 * that is attached moves as its source does, and one that is detached stays
 * exactly where it was left - reading it does not catch it up.
 */

const countingStorage = () => {
  let observers = 0;

  const storage: SyncExternalStorage<any> = () => ({
    get: noop,
    set: noop,
    observe() {
      observers++;

      return () => {
        observers--;
      };
    },
  });

  return {
    storage,
    get observers() {
      return observers;
    },
  };
};

test('created outside a hook, a derived control subscribes at once', async () => {
  const $src = createControl(1);

  const $doubled = createDerivedControl($src, (value: number) => value * 2);

  setValue($src, 2);

  await tick();

  // it moved without anyone reading it first
  assert.equal(getValue($doubled), 4, 'nothing to wait for, so it is attached');
});

test('created by a hook, it subscribes at the commit and drops at the unmount', async () => {
  const $src = createControl(1);

  const rendered = renderHook(() =>
    useDerivedControl($src, (value: number) => value * 2)
  );

  setValue($src, 2);

  await tick();

  assert.equal(getValue(rendered.result), 4, 'the commit attached it');

  rendered.unmount();

  setValue($src, 3);

  await tick();

  assert.equal(getValue(rendered.result), 4, 'the unmount dropped it');

  rendered.remount();

  await tick();

  assert.equal(
    getValue(rendered.result),
    6,
    'and an <Activity> coming back re-attaches'
  );
});

test('what moved while it was detached is caught up with on the way back', async () => {
  const $src = createControl(1);

  const rendered = renderHook(() =>
    useDerivedControl($src, (value: number) => value * 2)
  );

  const $doubled = rendered.result;

  // hidden by an <Activity>: the effects are gone, so nothing is heard
  rendered.unmount();

  setValue($src, 5);

  await tick();

  assert.equal(getValue($doubled), 2, 'it heard nothing while detached');

  rendered.remount();

  await tick();

  assert.equal(getValue($doubled), 10, 'the resubscribe recomputed it');
});

test('an observable external storage is observed on the same terms', async () => {
  const outside = countingStorage();

  createControl(1, outside.storage);

  assert.equal(
    outside.observers,
    1,
    'created outside a hook, observed at once'
  );

  const inHook = countingStorage();

  const duringRender: number[] = [];

  const rendered = renderHook(() => {
    const $control = useControl(1, inHook.storage);

    duringRender.push(inHook.observers);

    return $control;
  });

  assert.deepEqual(duringRender, [0], 'the render observed nothing');
  assert.equal(inHook.observers, 1, 'the commit did');

  rendered.unmount();

  assert.equal(inHook.observers, 0, 'and the unmount stopped observing');
});

test('every bound control is its own, and a hook mounts and drops it', async () => {
  const registry = createRegistry(createControl, (id: number) => ({ n: id }));

  const $key = createPrimitiveControl(1);

  const $first = createBoundControl(registry, $key);

  const $second = createBoundControl(registry, $key);

  assert.notStrictEqual($first, $second, 'nothing is cached to hand back');

  setValue($key, 2);

  await tick();

  assert.deepEqual(getValue($first), { n: 2 });
  assert.deepEqual(getValue($second), { n: 2 }, 'both follow the key');

  const rendered = renderHook(() => useBoundControl(registry)($key));

  setValue($key, 3);

  await tick();

  assert.deepEqual(
    getValue(rendered.result),
    { n: 3 },
    'the commit attached it'
  );

  rendered.unmount();

  setValue($key, 4);

  await tick();

  assert.deepEqual(
    getValue(rendered.result),
    { n: 3 },
    'unmounted, it hears nothing'
  );

  rendered.remount();

  await tick();

  assert.deepEqual(
    getValue(rendered.result),
    { n: 4 },
    'and coming back resolves the item the key points at now'
  );
});

test('a registry item stops observing its external storage when it is dropped', () => {
  const outside = countingStorage();

  const registry = createRegistry(createControl, 1, {
    externalStorage: outside.storage,
  });

  registry.get('a');

  registry.get('b');

  assert.equal(outside.observers, 2, 'a registry item never has a scope');

  registry.delete('a');

  assert.equal(outside.observers, 1, 'deleting it stopped observing');

  registry.clear();

  assert.equal(outside.observers, 0, 'and so does clearing the rest');
});

test('a nested registry unobserves everything under a deleted prefix', () => {
  const outside = countingStorage();

  const registry = createRegistry(createControl, 1, {
    externalStorage: outside.storage,
  });

  registry.get('a', 1);

  registry.get('a', 2);

  registry.get('b', 1);

  assert.equal(outside.observers, 3);

  registry.delete('a');

  assert.equal(outside.observers, 1, 'both items under the prefix are gone');
});

test('a registry whose storage never observes has nothing to clean up', () => {
  const storage: SyncExternalStorage<number> = () => ({
    get: () => undefined,
    set: noop,
  });

  const registry = createRegistry(createControl, 1, {
    externalStorage: storage,
  });

  registry.get('a');

  assert.equal(registry.delete('a'), true, 'no observer, no cleanup');

  registry.get('b');

  registry.clear();
});

test('a storage written between the render and the commit is read again', async () => {
  let stored: number | undefined = 1;

  const storage: SyncExternalStorage<number> = () => ({
    get: () => stored,
    set: (value) => {
      stored = value;
    },
    observe: () => noop,
  });

  const rendered = renderHook(() => {
    const $control = useControl(0, storage);

    // the window the subscription misses: nothing observes the storage yet
    stored = 2;

    return $control;
  });

  await tick();

  assert.equal(
    getValue(rendered.result),
    2,
    'the subscription caught up on the way in'
  );
});

test('a bound hook keeps one control per call position, however many there are', async () => {
  const registry = createRegistry(createControl, (id: number) => ({ n: id }));

  const $a = createPrimitiveControl(1);

  const $b = createPrimitiveControl(2);

  let keys = [$a];

  const rendered = renderHook(() => {
    const bind = useBoundControl(registry);

    return keys.map((key) => bind(key));
  });

  const [$first] = rendered.result;

  setValue($a, 5);

  await tick();

  assert.deepEqual(getValue($first), { n: 5 }, 'the first position mounted');

  keys = [$a, $b];

  const [, $grown] = rendered.render();

  assert.equal(rendered.result[0], $first, 'the position kept its control');

  setValue($b, 7);

  await tick();

  assert.deepEqual(
    getValue($grown),
    { n: 7 },
    'and the one the render grew into mounted'
  );

  keys = [$a];

  rendered.render();

  setValue($b, 8);

  await tick();

  assert.deepEqual(
    getValue($grown),
    { n: 7 },
    'a position a render stops reaching drops'
  );

  keys = [$b];

  const [$rebuilt] = rendered.render();

  await tick();

  assert.notStrictEqual($rebuilt, $first, 'other keys rebuild the position');
  assert.deepEqual(getValue($rebuilt), { n: 8 }, 'following the key it got');

  setValue($a, 9);

  await tick();

  assert.deepEqual(
    getValue($first),
    { n: 5 },
    'and letting go of the previous one'
  );

  rendered.unmount();

  setValue($b, 10);

  await tick();

  assert.deepEqual(
    getValue($rebuilt),
    { n: 8 },
    'the unmount drops what is left'
  );
});

test('a catch-up commits at once, not on the scheduled flush', async () => {
  const $src = createControl(1);

  const rendered = renderHook(() =>
    useDerivedControl($src, (value: number) => value * 2)
  );

  rendered.unmount();

  setValue($src, 5);

  await tick();

  // no tick after the mount: it is the catch-up, and it commits right there
  rendered.remount();

  assert.equal(getValue(rendered.result), 10);
});

test('a chain catches up from the bottom, so nothing reads a stale source', async () => {
  const $src = createControl(1);

  const rendered = renderHook(() => {
    const $doubled = useDerivedControl($src, (value: number) => value * 2);

    return useDerivedControl($doubled, (value: number) => value * 2);
  });

  rendered.unmount();

  setValue($src, 5);

  await tick();

  rendered.remount();

  assert.equal(
    getValue(rendered.result),
    20,
    'the one in the middle was caught up with first'
  );
});

test('an unmount arms the catch-up again, so a remount re-reads the storage', () => {
  let stored: number | undefined = 1;

  const storage: SyncExternalStorage<number> = () => ({
    get: () => stored,
    set: (value) => {
      stored = value;
    },
    observe: () => noop,
  });

  const rendered = renderHook(() => useControl(0, storage));

  rendered.unmount();

  stored = 7;

  rendered.remount();

  assert.equal(
    getValue(rendered.result),
    7,
    'what the storage did while nothing observed it is read on the way back'
  );
});

test('the mount takes the value, and the reader after it renders with it', async () => {
  const $src = createControl(1);

  // detached - the state a parent's control is in while the child that reads
  // it is already committing
  const rendered = renderHook(() =>
    useDerivedControl($src, (value: number) => value * 2)
  );

  const $doubled = rendered.result;

  rendered.unmount();

  setValue($src, 5);

  await tick();

  assert.equal(getValue($doubled), 2, 'nothing of it is attached yet');

  // the mount, an insertion effect - which every reader of the commit renders
  // before and attaches after, so the catch-up reaches none of them
  rendered.remount();

  assert.equal(getValue($doubled), 10, 'and it took the value on the way');

  const seen: number[] = [];

  renderHook(() => {
    seen.push(useValue($doubled));
  });

  assert.deepEqual(seen, [10], 'so a reader renders with it once');
});

test('nothing takes the value of one whose creation never mounts', async () => {
  const $src = createControl(1);

  const rendered = renderHook(() =>
    useDerivedControl($src, (value: number) => value * 2)
  );

  const $doubled = rendered.result;

  rendered.unmount();

  setValue($src, 5);

  await tick();

  const seen: number[] = [];

  renderHook(() => {
    seen.push(useValue($doubled));
  });

  // the same rule a suspended render falls under: a control the tree never
  // mounts is nobody's to catch up
  assert.deepEqual(seen, [2], 'what it was left holding, for as long as it is');
});

test('an item a bound control resolves is observed like any other', () => {
  const counter = countingStorage();

  const reg = createRegistry(createControl, 0, {
    externalStorage: counter.storage,
  });

  const $key = createPrimitiveControl(7);

  // a hook's scope is around this, and the item outlives whatever it belongs to
  renderHook(() => useBoundControl(reg)($key));

  assert.equal(counter.observers, 1, 'the item it resolved observes');

  assert.equal(
    getValue(reg.get(7)),
    undefined,
    'so a later get of it owes no catch-up'
  );
  assert.equal(counter.observers, 1, 'and is the one already observing');
});

test('clearing a registry stops observing what a bind resolved', () => {
  const counter = countingStorage();

  const reg = createRegistry(createControl, 0, {
    externalStorage: counter.storage,
  });

  reg.get(1);

  const $key = createPrimitiveControl(2);

  renderHook(() => useBoundControl(reg)($key));

  assert.equal(counter.observers, 2);

  reg.delete(2);

  assert.equal(counter.observers, 1, 'the one it dropped stopped');

  reg.clear();

  assert.equal(counter.observers, 0, 'and the rest with it');
});

test('a storage that observes only some of its items still clears', () => {
  let observers = 0;

  // `observe` is optional, and the factory sees the keys - so one item can be
  // watched while its neighbour is not
  const storage: SyncExternalStorage<any> = (keys: any) =>
    keys && keys[0] === 1
      ? {
          get: noop,
          set: noop,
          observe() {
            observers++;

            return () => {
              observers--;
            };
          },
        }
      : { get: noop, set: noop };

  const reg = createRegistry(createControl, 0, { externalStorage: storage });

  reg.get(1);

  reg.get(2);

  assert.equal(observers, 1, 'only the one that asked to be');

  reg.clear();

  assert.equal(observers, 0, 'and the other one is nothing to stop');
});

test('a bound control made before a key is ready calls no keyed default', async () => {
  const calls: unknown[][] = [];

  const registry = createRegistry(createControl, (...keys: unknown[]) => {
    calls.push(keys);

    return `chat-${keys[0]}`;
  });

  // the item type has to be known here, and there is no item to read it off:
  // whatever answers that must not be a default the keys are missing for
  const $key = createControl<string | undefined>(undefined);

  const $bound = createBoundControl(registry as any, $key as any);

  assert.deepEqual(calls, [], 'nothing was made for a key there is none of');
  assert.equal(getValue($bound as any), undefined);

  setValue($key, 'a');

  await tick();

  assert.deepEqual(calls, [['a']], 'the item is made with the key itself');
  assert.equal(getValue($bound as any), 'chat-a');
});

test('and it still knows the item loads, so it starts out loading', async () => {
  const calls: unknown[][] = [];

  const loaded: string[] = [];

  const registry = createRegistry(createAsyncControl, {
    initialValue: (...keys: unknown[]) => {
      calls.push(keys);

      return undefined;
    },
    load: (handle: any, keys: any) => {
      loaded.push(keys[0]);

      handle.setValue(`user-${keys[0]}`);
    },
  } as any);

  const $key = createControl<string | undefined>(undefined);

  const $bound = createBoundControl(registry as any, $key as any);

  const $loading = selectLoading($bound as any);

  retain($bound as any);

  assert.deepEqual(calls, [], 'the keyed initial value was left alone');
  assert.equal(
    getValue($loading),
    true,
    'a loadable item is what it waits for'
  );
  assert.deepEqual(loaded, [], 'and nothing was asked for yet');

  setValue($key, 'a');

  await tick();

  assert.deepEqual(calls, [['a']]);
  assert.deepEqual(loaded, ['a']);
  assert.equal(getValue($bound as any), 'user-a');
  assert.equal(getValue($loading), false);
});

test('a dropped item is still what the control bound to it reads', async () => {
  const registry = createRegistry(createControl, (id: number) => `item-${id}`);

  const $key = createPrimitiveControl(1);

  const $bound: any = createBoundControl(registry as any, $key as any);

  // watching is the mount: it is what a rendered `useValue` opens
  const unwatch = watchValue($bound, noop);

  setValue(registry.get(1) as any, 'edited');

  await tick();

  assert.equal(getValue($bound), 'edited');

  // nothing tracks who is bound to an item, so this is the caller's call
  registry.delete(1);

  assert.equal(getValue($bound), 'edited', 'it reads the one it resolved');

  setValue($key, 2);

  await tick();

  assert.equal(getValue($bound), 'item-2');

  setValue($key, 1);

  await tick();

  assert.equal(getValue($bound), 'item-1', 'and a key move binds a fresh one');

  unwatch();
});

test('a registry that throws while an item is built keeps the flush', async () => {
  const registry = createRegistry(createControl, (id: number) => {
    if (id == 2) {
      throw new Error('the factory blew up');
    }

    return { n: id };
  });

  const $key = createPrimitiveControl(1);

  const $bound: any = createBoundControl(registry as any, $key as any);

  // watching is the mount: it is what a rendered `useValue` opens
  const unwatch = watchValue($bound, noop);

  const $other = createPrimitiveControl('start');

  const seen: string[] = [];

  const unwatchOther = watchValue($other, (value: string) => {
    seen.push(value);
  });

  await tick();

  assert.deepEqual(getValue($bound), { n: 1 });

  // the item of key 2 is built inside the commit, and building it throws
  setValue($key, 2);

  setValue($other, 'same flush');

  await tick();

  assert.equal(
    (reportedErrors.at(-1) as Error).message,
    'the factory blew up',
    'the throw is reported, not swallowed'
  );

  assert.equal(getValue($bound), undefined, 'the key resolves to nothing');

  assert.deepEqual(seen, ['same flush'], 'and the rest of the flush landed');

  // whatever the flush left behind must not outlive it
  setValue($other, 'later');

  await tick();

  assert.deepEqual(seen, ['same flush', 'later'], 'the next one flushes too');

  unwatch();

  unwatchOther();
});
