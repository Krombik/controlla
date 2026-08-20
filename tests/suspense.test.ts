// the env module must come first: it installs the browser mocks
import { tick } from './_env/dom.ts';
import assert from 'node:assert';
import test from 'node:test';

import createAsyncControl from '../src/core/createAsyncControl/index.ts';
import useSuspenseValue from '../src/core/useSuspenseValue/index.ts';
import $never from '../src/core/never/index.ts';
import { INTERNALS } from '../src/core/_internal/constants.ts';
import syncScheduler from '../src/scheduler/syncScheduler/index.ts';
import { renderHook } from './_env/hooks.ts';

/** Renders the hook, keeping whatever it threw instead of failing the render. */
const suspending = <T>(hook: () => T) => {
  let thrown: unknown;

  const rendered = renderHook(() => {
    try {
      return hook();
    } catch (err) {
      thrown = err;

      return undefined;
    }
  });

  return {
    ...rendered,
    get thrown() {
      return thrown;
    },
  };
};

const loadable = () => {
  let answer!: (value: number) => void;

  let loadCount = 0;

  const $control = createAsyncControl<number>({
    load(handle) {
      loadCount++;

      answer = (value) => {
        handle.setValue(value);
      };
    },
  });

  return {
    $control,
    answer: (value: number) => answer(value),
    get loadCount() {
      return loadCount;
    },
    get activeCount() {
      return ($control as any)[INTERNALS]._load._activeCount as number;
    },
  };
};

test('a suspended render starts the load and the commit takes the hold over', async () => {
  const item = loadable();

  const rendered = suspending(() => useSuspenseValue(item.$control));

  assert.ok(rendered.thrown instanceof Promise, 'it suspended');
  assert.equal(item.loadCount, 1, 'the render is what started the load');
  assert.equal(item.activeCount, 1, 'held by nothing but the suspension');

  item.answer(42);

  await tick();

  assert.equal(
    item.activeCount,
    0,
    'the loading it was held for is over, so the hold is gone'
  );

  // React's retry: the value is there, so this one commits
  assert.equal(rendered.render(), 42);
  assert.equal(
    item.activeCount,
    1,
    'the mount holds it, the suspension no more'
  );
  assert.equal(item.loadCount, 1, 'and nothing reloaded');

  rendered.unmount();

  assert.equal(item.activeCount, 0);
});

test('however many suspend on one control, the load is held once', async () => {
  const item = loadable();

  const first = suspending(() => useSuspenseValue(item.$control));

  const second = suspending(() => useSuspenseValue(item.$control));

  assert.ok(first.thrown instanceof Promise);
  assert.ok(second.thrown instanceof Promise);
  assert.equal(item.loadCount, 1);
  assert.equal(item.activeCount, 1, 'one hold for both');
});

test('a hold left by a render that never commits goes with the value', async () => {
  const item = loadable();

  suspending(() => useSuspenseValue(item.$control));

  assert.equal(item.activeCount, 1);

  // nothing ever commits - the end of the loading is what ends the hold
  item.answer(1);

  await tick();

  assert.equal(item.activeCount, 0, 'nothing is left holding the load');
});

test('a poll answering its first value keeps the loader it is running on', async () => {
  let answer!: (value: { done: boolean }) => void;

  let loadCount = 0;

  let cleanupCount = 0;

  const $control = createAsyncControl<{ done: boolean }>({
    isLoaded: (value) => value.done,
    load(handle) {
      loadCount++;

      answer = (value) => {
        handle.setValue(value);
      };

      return () => {
        cleanupCount++;
      };
    },
  });

  const rendered = suspending(() => useSuspenseValue($control));

  assert.ok(rendered.thrown instanceof Promise);

  // the first answer is not the end of the polling, but it does settle the
  // promise the suspension threw
  answer({ done: false });

  await tick();

  assert.equal(cleanupCount, 0, 'the loader is still the one running');

  assert.deepEqual(rendered.render(), { done: false });

  await tick();

  assert.equal(cleanupCount, 0, 'and the commit took the hold over untouched');
  assert.equal(loadCount, 1, 'nothing restarted it');
});

test('an orphaned hold on a poll lasts until the polling is done', async () => {
  let answer!: (value: { done: boolean }) => void;

  const $control = createAsyncControl<{ done: boolean }>({
    isLoaded: (value) => value.done,
    load(handle) {
      answer = (value) => {
        handle.setValue(value);
      };
    },
  });

  const activeCount = () => ($control as any)[INTERNALS]._load._activeCount;

  // nothing ever commits
  suspending(() => useSuspenseValue($control));

  answer({ done: false });

  await tick();

  assert.equal(activeCount(), 1, 'a poll mid-flight is not a load that ended');

  answer({ done: true });

  await tick();

  assert.equal(activeCount(), 0);
});

test('a loader answering inside the render leaves no hold behind', async () => {
  const $control = createAsyncControl<number>({
    load(handle) {
      // the whole load, before `_attach` even returned
      handle.setValue(7, syncScheduler);
    },
  });

  suspending(() => useSuspenseValue($control));

  await tick();

  assert.equal(
    ($control as any)[INTERNALS]._load._activeCount,
    0,
    'the loading was over before anything could commit'
  );
});

test('$never throws a thenable that never settles, a fresh one each time', () => {
  const first = suspending(() => useSuspenseValue($never));

  const second = suspending(() => useSuspenseValue($never));

  const thrown = first.thrown as Promise<never>;

  assert.ok(thrown instanceof Promise);
  assert.notStrictEqual(thrown, second.thrown, 'not the shared one');

  let settled = false;

  thrown.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    }
  );

  assert.equal(settled, false);
});
