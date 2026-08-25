// the env module must come first: it installs a real DOM before React loads
import { act, createElement as h, mount } from './_env/react.ts';
import assert from 'node:assert';
import test from 'node:test';
import { Suspense } from 'react';
import createAsyncControl from '../src/core/createAsyncControl/index.ts';
import useAsyncDerivedControl from '../src/core/useAsyncDerivedControl/index.ts';
import useSuspenseValue from '../src/core/useSuspenseValue/index.ts';
import suspendOnControl from '../src/core/_internal/suspendOnControl.ts';
import invalidate from '../src/core/invalidate/index.ts';
import $never from '../src/core/never/index.ts';
import { INTERNALS } from '../src/core/_internal/constants.ts';
import syncScheduler from '../src/scheduler/syncScheduler/index.ts';

/** What is keeping the control's loading in use - a suspension, or a mount. */
const holds = (control: any) => control[INTERNALS]._load._activeCount as number;

/** How many dependents the control is notifying. */
const dependents = (control: any) =>
  (control[INTERNALS]._dependents as unknown[]).length;

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
  assert.equal(holds(item.$control), 1, 'held by nothing but the suspension');

  await act(async () => {
    item.answer(42);
  });

  assert.equal(tree.container.textContent, '42');
  assert.equal(
    holds(item.$control),
    1,
    'the mount holds it, the suspense no more'
  );
  assert.equal(item.loads, 1, 'and nothing reloaded');

  await tree.unmount();

  assert.equal(holds(item.$control), 0);
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

  assert.equal(item.loads, 1);
  assert.equal(holds(item.$control), 1, 'one hold for all of them');
});

test('a hold left by a render that never commits goes with the value', async () => {
  const item = loadable();

  const tree = await mount(boundary(item.$control));

  assert.equal(holds(item.$control), 1);

  // nothing ever commits - React runs no cleanup for a render it threw away,
  // so the end of the loading is what has to end the hold
  await tree.unmount();

  await act(async () => {
    item.answer(1);
  });

  assert.equal(holds(item.$control), 0, 'nothing is left holding the load');

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
  assert.equal(holds(item.$control), 1, 'and the hold came across untouched');
});

test('an orphaned hold on a poll lasts until the polling is done', async () => {
  const item = loadable({ isLoaded: (value: any) => value.done });

  const tree = await mount(boundary(item.$control));

  // nothing ever commits
  await tree.unmount();

  await act(async () => {
    item.answer({ done: false });
  });

  assert.equal(
    holds(item.$control),
    1,
    'a poll mid-flight is not a load that ended'
  );

  await act(async () => {
    item.answer({ done: true });
  });

  assert.equal(holds(item.$control), 0);
});

test('a loader answering inside the render leaves no hold behind', async () => {
  const $control: any = createAsyncControl<number>({
    load(handle) {
      // the whole load, before `_attach` even returned
      handle.setValue(7, syncScheduler);
    },
  });

  const tree = await mount(boundary($control));

  assert.equal(
    tree.container.textContent,
    '7',
    'there was nothing to wait for'
  );
  assert.equal(holds($control), 1, 'the mount is the only hold there ever was');

  await tree.unmount();

  assert.equal(holds($control), 0);
});

test('$never suspends forever, on a thenable of its own each time', async () => {
  const tree = await mount(boundary($never));

  assert.equal(tree.container.textContent, 'loading');

  const internals: any = ($never as any)[INTERNALS];

  const first = suspendOnControl(internals);

  const second = suspendOnControl(internals);

  assert.ok(first instanceof Promise);
  assert.notStrictEqual(first, second, 'not one shared thenable');

  let settled = false;

  first.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    }
  );

  await act(async () => {});

  assert.equal(settled, false, 'and neither of them ever settles');
  assert.equal(tree.container.textContent, 'loading');
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
  assert.equal(
    dependents(item.$control),
    0,
    'and none of them is following the source either'
  );
});
