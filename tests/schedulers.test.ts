import { tick } from './_env/dom.ts';
import assert from 'node:assert';
import test from 'node:test';
import createControl from '../src/core/createControl/index.ts';
import setValue from '../src/core/setValue/index.ts';
import getValue from '../src/core/getValue/index.ts';
import watchValue from '../src/core/watchValue/index.ts';
import createDebounceScheduler from '../src/scheduler/createDebounceScheduler/index.ts';
import createThrottleScheduler from '../src/scheduler/createThrottleScheduler/index.ts';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test('a debounce scheduler commits once the writes stop', async () => {
  const $search = createControl('');

  const seen: string[] = [];

  const unwatch = watchValue($search, (value: string) => {
    seen.push(value);
  });

  const scheduler = createDebounceScheduler(30);

  setValue($search, 'a', scheduler);

  setValue($search, 'ab', scheduler);

  await tick();

  assert.deepEqual(seen, [], 'nothing yet, and nothing on the microtask');
  assert.equal(getValue($search), '', 'the write is not the commit');

  await sleep(20);

  // the window restarts on every write
  setValue($search, 'abc', scheduler);

  await sleep(20);

  assert.deepEqual(seen, [], 'the third write pushed it out again');

  await sleep(25);

  assert.deepEqual(seen, ['abc'], 'one commit, with the last of them');
  assert.equal(getValue($search), 'abc');

  unwatch();
});

test('and its flush commits what is waiting, once', async () => {
  const $search = createControl('');

  const seen: string[] = [];

  const unwatch = watchValue($search, (value: string) => {
    seen.push(value);
  });

  const scheduler = createDebounceScheduler(1000);

  setValue($search, 'now', scheduler);

  assert.equal(scheduler.flush(), true, 'there was something to flush');
  assert.deepEqual(seen, ['now']);

  assert.equal(scheduler.flush(), false, 'and nothing left after it');
  assert.deepEqual(seen, ['now']);

  // the timer it cleared must not commit a second time
  await sleep(30);

  assert.deepEqual(seen, ['now']);

  unwatch();
});

test('a throttle scheduler commits on the window it opened', async () => {
  const $cursor = createControl(0);

  const seen: number[] = [];

  const unwatch = watchValue($cursor, (value: number) => {
    seen.push(value);
  });

  const scheduler = createThrottleScheduler(30);

  setValue($cursor, 1, scheduler);

  await sleep(20);

  // inside the window the first write opened: it is not pushed out
  setValue($cursor, 2, scheduler);

  await sleep(20);

  assert.deepEqual(seen, [2], 'one commit, with the last value in the window');

  setValue($cursor, 3, scheduler);

  await sleep(40);

  assert.deepEqual(seen, [2, 3], 'and the next window is its own commit');

  unwatch();
});

test('a scheduler of its own is a lane of its own', async () => {
  const $a = createControl('a');

  const $b = createControl('b');

  const order: string[] = [];

  const unwatchA = watchValue($a, (value: string) => {
    order.push(`a:${value}`);
  });

  const unwatchB = watchValue($b, (value: string) => {
    order.push(`b:${value}`);
  });

  const slow = createDebounceScheduler(40);

  setValue($a, 'slow', slow);

  // the default lane is a microtask, and it is not held up by the other one
  setValue($b, 'fast');

  await tick();

  assert.deepEqual(order, ['b:fast']);

  await sleep(50);

  assert.deepEqual(order, ['b:fast', 'a:slow']);

  unwatchA();

  unwatchB();
});
