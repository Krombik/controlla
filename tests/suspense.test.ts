// the env module must come first: it installs a real DOM before React loads
import { act, createElement as h, mount } from './_env/react.ts';
import assert from 'node:assert';
import test from 'node:test';
import { Suspense } from 'react';
import createAsyncControl from '../build/core/createAsyncControl/index.js';
import useAsyncDerivedControl from '../build/core/useAsyncDerivedControl/index.js';
import useSuspenseValue from '../build/core/useSuspenseValue/index.js';
import invalidate from '../build/core/invalidate/index.js';
import $never from '../build/core/never/index.js';
import syncScheduler from '../build/scheduler/syncScheduler/index.js';

/**
 * Whether anything still holds the control's loading is not a number anyone
 * can read from outside - what is observable is the loader's own cleanup,
 * which runs exactly when the last hold goes.
 */

const loadable = (options: any = {}) => {
  let answer!: (value: any) => void;

  let loads = 0;

  let cleanups = 0;

  const $control: any = createAsyncControl<any>({
    ...options,
    load(handle: any) {
      loads++;

      answer = (value) => {
        handle.setValue(value);
      };

      return () => {
        cleanups++;
      };
    },
  });

  return {
    $control,
    answer: (value: any) => answer(value),
    get loads() {
      return loads;
    },
    get cleanups() {
      return cleanups;
    },
  };
};

/** A boundary whose child reads {@link control} and so suspends on it. */
const boundary = (control: any, extra?: any) =>
  h(
    Suspense,
    { fallback: h('span', null, 'loading') },
    h(() => h('span', null, String(useSuspenseValue(control)))),
    extra
  );

test('a suspended render starts the load and the commit takes the hold over', async () => {
  const item = loadable();

  const tree = await mount(boundary(item.$control));

  assert.equal(tree.container.textContent, 'loading', 'it suspended');
  assert.equal(item.loads, 1, 'the render is what started the load');
  assert.equal(item.cleanups, 0, 'held by nothing but the suspension');

  await act(async () => {
    item.answer(42);
  });

  assert.equal(tree.container.textContent, '42');
  assert.equal(item.loads, 1, 'and nothing reloaded');

  // what holds a loaded control is only visible in what an invalidate does:
  // held, it loads again; let go, there is nothing left to reload it
  await act(async () => {
    invalidate(item.$control);
  });

  assert.equal(item.loads, 2, 'the mount holds it, the suspense no more');

  await act(async () => {
    item.answer(43);
  });

  await tree.unmount();

  await act(async () => {
    invalidate(item.$control);
  });

  assert.equal(item.loads, 2, 'and the unmount let go');
});

test('however many suspend on one control, the load is held once', async () => {
  const item = loadable();

  const Read = () => h('span', null, String(useSuspenseValue(item.$control)));

  await mount(
    h(
      Suspense,
      { fallback: h('span', null, 'loading') },
      h(Read),
      h(Read),
      h(Read)
    )
  );

  assert.equal(item.loads, 1, 'one load for all of them');
  assert.equal(item.cleanups, 0, 'still loading, so still held');
});

test('a hold left by a render that never commits goes with the value', async () => {
  const item = loadable();

  const tree = await mount(boundary(item.$control));

  assert.equal(item.cleanups, 0);

  // nothing ever commits - React runs no cleanup for a render it threw away,
  // so the end of the loading is what has to end the hold
  await tree.unmount();

  await act(async () => {
    item.answer(1);
  });

  assert.equal(item.cleanups, 1, 'nothing is left holding the load');

  await act(async () => {
    invalidate(item.$control);
  });

  assert.equal(item.loads, 1, 'and nothing is there to reload it');
});

test('a poll answering its first value keeps the loader it is running on', async () => {
  const item = loadable({ isLoaded: (value: any) => value.done });

  const tree = await mount(boundary(item.$control));

  assert.equal(tree.container.textContent, 'loading');

  // the first answer is not the end of the polling, but it does settle the
  // promise the suspension threw
  await act(async () => {
    item.answer({ done: false });
  });

  assert.equal(tree.container.textContent, '[object Object]', 'it committed');
  assert.equal(item.cleanups, 0, 'the loader is still the one running');
  assert.equal(item.loads, 1, 'nothing restarted it');

  // the hold came across the commit untouched, so letting go is what ends it
  await tree.unmount();

  assert.equal(item.cleanups, 1);
});

test('an orphaned hold on a poll lasts until the polling is done', async () => {
  const item = loadable({ isLoaded: (value: any) => value.done });

  const tree = await mount(boundary(item.$control));

  // nothing ever commits
  await tree.unmount();

  await act(async () => {
    item.answer({ done: false });
  });

  assert.equal(item.cleanups, 0, 'a poll mid-flight is not a load that ended');

  await act(async () => {
    item.answer({ done: true });
  });

  assert.equal(item.cleanups, 1);
});

test('a loader answering inside the render leaves no hold behind', async () => {
  let loads = 0;

  const $control: any = createAsyncControl<number>({
    load(handle) {
      loads++;

      // the whole load, before the attach even returned
      handle.setValue(7, syncScheduler);
    },
  });

  const tree = await mount(boundary($control));

  assert.equal(
    tree.container.textContent,
    '7',
    'there was nothing to wait for'
  );

  // the load ended inside the render, so its cleanup has already run - what
  // the mount still holds is only visible in an invalidate landing
  await act(async () => {
    invalidate($control);
  });

  assert.equal(loads, 2, 'the mount is the only hold there ever was');

  await tree.unmount();

  await act(async () => {
    invalidate($control);
  });

  assert.equal(loads, 2, 'and nothing is left to reload it');
});

test('$never suspends forever, and each suspension waits on its own', async () => {
  const tree = await mount(boundary($never));

  assert.equal(tree.container.textContent, 'loading');

  // a second boundary over the same skeleton - if they shared one thenable,
  // settling either would take both out of the fallback together
  const other = await mount(boundary($never));

  assert.equal(other.container.textContent, 'loading');

  await act(async () => {});

  assert.equal(tree.container.textContent, 'loading', 'neither ever settles');
  assert.equal(other.container.textContent, 'loading');

  await other.unmount();

  await act(async () => {});

  assert.equal(
    tree.container.textContent,
    'loading',
    'and one going does not settle the other'
  );
});

test('a control a suspending render makes never settles - do not make one', async () => {
  const item = loadable();

  let made = 0;

  // the rule, not a bug to fix: React runs no effect of a render it throws
  // away, so nothing ever subscribes what that render made. A control nothing
  // subscribes never hears its source, so it never recomputes and the promise
  // it threw never settles - the boundary is stuck on the fallback for good.
  // Make the control above the boundary and suspend on it there
  const Read = () => {
    made++;

    const $doubled = useAsyncDerivedControl(
      item.$control,
      (value: number) => value * 2
    );

    return h('span', null, String(useSuspenseValue($doubled as any)));
  };

  const tree = await mount(
    h(Suspense, { fallback: h('span', null, 'loading') }, h(Read))
  );

  assert.ok(made >= 1, 'the attempts each made their own');

  await act(async () => {
    item.answer(21);
  });

  assert.equal(
    tree.container.textContent,
    'loading',
    'what it suspended on is waiting for a mount that never comes'
  );

  // how many of them are following the source is not observable; that none of
  // them left it broken is - a boundary over the control itself still lands
  const fresh = await mount(boundary(item.$control));

  assert.equal(fresh.container.textContent, '21');
  assert.equal(item.loads, 1, 'and nothing reloaded to get there');
});
