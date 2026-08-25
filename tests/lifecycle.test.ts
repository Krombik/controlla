// the env module must come first: it installs the browser mocks
import { tick, reportedErrors } from './_env/dom.ts';
import assert from 'node:assert';
import test from 'node:test';

import createControl from '../src/core/createControl/index.ts';
import createAsyncControl from '../src/core/createAsyncControl/index.ts';
import createPrimitiveControl from '../src/core/createPrimitiveControl/index.ts';
import createRegistry from '../src/core/createRegistry/index.ts';
import createBoundControl from '../src/core/createBoundControl/index.ts';
import useBoundControl from '../src/core/useBoundControl/index.ts';
import createDerivedControl from '../src/core/createDerivedControl/index.ts';
import useControl from '../src/core/useControl/index.ts';
import useDerivedControl from '../src/core/useDerivedControl/index.ts';
import getValue from '../src/core/getValue/index.ts';
import watchValue from '../src/core/watchValue/index.ts';
import selectLoading from '../src/core/selectLoading/index.ts';
import retain from '../src/core/retain/index.ts';
import useValue from '../src/core/useValue/index.ts';
import setValue from '../src/core/setValue/index.ts';
import noop from '../src/core/_internal/noop.ts';
import { INTERNALS } from '../src/core/_internal/constants.ts';
import {
  actualizePending,
  cleanupScope,
} from '../src/core/_internal/cleanup.ts';
import {
  flushLane,
  getSchedulerLane,
} from '../src/core/_internal/flushQueue.ts';
import type { Subscription } from '../src/core/_internal/types.ts';
import { renderHook } from './_env/hooks.ts';
import type { SyncExternalStorage } from '../src/core/types.ts';

/** How many dependents the control is notifying. */
const dependents = (control: any) =>
  (control[INTERNALS]._dependents as unknown[]).length;

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

  assert.equal(dependents($src), 0);

  const $doubled = createDerivedControl($src, (value: number) => value * 2);

  assert.equal(dependents($src), 1, 'nothing to wait for, so it is attached');

  setValue($src, 2);

  await tick();

  assert.equal(getValue($doubled), 4);
});

test('created by a hook, it subscribes at the commit and drops at the unmount', async () => {
  const $src = createControl(1);

  const duringRender: number[] = [];

  const rendered = renderHook(() => {
    const $doubled = useDerivedControl($src, (value: number) => value * 2);

    duringRender.push(dependents($src));

    return $doubled;
  });

  assert.deepEqual(duringRender, [0], 'the render attached nothing');
  assert.equal(dependents($src), 1, 'the effect did');

  setValue($src, 2);

  await tick();

  assert.equal(getValue(rendered.result), 4);

  rendered.unmount();

  assert.equal(dependents($src), 0);

  rendered.remount();

  assert.equal(
    dependents($src),
    1,
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
  assert.equal(inHook.observers, 1);

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

  const attached = dependents($key);

  const duringRender: number[] = [];

  const rendered = renderHook(() => {
    const $bound = useBoundControl(registry)($key);

    duringRender.push(dependents($key));

    return $bound;
  });

  assert.deepEqual(duringRender, [attached], 'the render attached nothing');
  assert.equal(dependents($key), attached + 1, 'its effect did');

  setValue($key, 3);

  await tick();

  assert.deepEqual(getValue(rendered.result), { n: 3 });

  rendered.unmount();

  assert.equal(dependents($key), attached);

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

  const attached = dependents($a);

  let keys = [$a];

  const rendered = renderHook(() => {
    const bind = useBoundControl(registry);

    return keys.map((key) => bind(key));
  });

  const [$first] = rendered.result;

  assert.equal(dependents($a), attached + 1, 'the first position mounted');

  keys = [$a, $b];

  assert.equal(rendered.render()[0], $first, 'the position kept its control');
  assert.equal(dependents($b), 1, 'and the one the render grew into mounted');

  keys = [$a];

  rendered.render();

  assert.equal(dependents($b), 0, 'a position a render stops reaching drops');
  assert.equal(dependents($a), attached + 1);

  keys = [$b];

  const [$rebuilt] = rendered.render();

  await tick();

  assert.notStrictEqual($rebuilt, $first, 'other keys rebuild the position');
  assert.deepEqual(getValue($rebuilt), { n: 2 }, 'following the key it got');
  assert.equal(dependents($a), attached, 'and letting go of the previous one');
  assert.equal(dependents($b), 1);

  rendered.unmount();

  assert.equal(dependents($b), 0, 'the unmount drops what is left');
});

/** Creates in a scope, the way a hook does, and hands back what it collected. */
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

test('a catch-up commits at once, not on the scheduled flush', () => {
  const $src = createControl(1);

  const [$doubled] = inScope(() =>
    createDerivedControl($src, (value: number) => value * 2)
  );

  setValue($src, 5);

  // no tick after it: the catch-up commits, so the commit running it sees it
  pull($doubled);

  assert.equal(getValue($doubled), 10);
});

test('a chain catches up from the bottom, so nothing reads a stale source', () => {
  const $src = createControl(1);

  const [$doubled] = inScope(() =>
    createDerivedControl($src, (value: number) => value * 2)
  );

  const [$quadrupled] = inScope(() =>
    createDerivedControl($doubled, (value: number) => value * 2)
  );

  setValue($src, 5);

  pull($quadrupled);

  assert.equal(
    getValue($quadrupled),
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

  // created, not mounted - the state a parent's control is in while the child
  // that reads it is already committing
  const [$doubled, scope] = inScope(() =>
    createDerivedControl($src, (value: number) => value * 2)
  );

  setValue($src, 5);

  await tick();

  assert.equal(dependents($src), 0, 'nothing of it is attached yet');

  // the mount, an insertion effect - which every reader of the commit renders
  // before and attaches after, so the catch-up reaches none of them
  scope[0]._subscribe();

  assert.equal(dependents($src), 1);
  assert.equal(getValue($doubled), 10, 'and it took the value on the way');

  const seen: number[] = [];

  renderHook(() => {
    seen.push(useValue($doubled));
  });

  assert.deepEqual(seen, [10], 'so a reader renders with it once');
});

test('nothing takes the value of one whose creation never mounts', async () => {
  const $src = createControl(1);

  const [$doubled] = inScope(() =>
    createDerivedControl($src, (value: number) => value * 2)
  );

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
  const [, scope] = inScope(() => createBoundControl(reg, $key));

  assert.equal(counter.observers, 1, 'the item it resolved observes');
  assert.equal(scope.length, 1, 'and the scope holds the bound control alone');

  const item: any = reg.get(7);

  assert.equal(
    item[INTERNALS]._root._pending,
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

  inScope(() => createBoundControl(reg, $key));

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

  const scope: Subscription[] = (cleanupScope._value = []);

  const $bound: any = createBoundControl(registry as any, $key as any);

  cleanupScope._value = null;

  scope[0]._subscribe();

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

  scope[0]._cleanup();
});

test('a registry that throws while an item is built keeps the flush', async () => {
  const registry = createRegistry(createControl, (id: number) => {
    if (id == 2) {
      throw new Error('the factory blew up');
    }

    return { n: id };
  });

  const $key = createPrimitiveControl(1);

  const scope: Subscription[] = (cleanupScope._value = []);

  const $bound: any = createBoundControl(registry as any, $key as any);

  cleanupScope._value = null;

  scope[0]._subscribe();

  const $other = createPrimitiveControl('start');

  const seen: string[] = [];

  const unwatch = watchValue($other, (value: string) => {
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

  scope[0]._cleanup();
});
