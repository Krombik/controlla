import { tick } from './_env/dom.ts';
import assert from 'node:assert';
import test from 'node:test';
import createRegistry from '../build/core/createRegistry/index.js';
import createAsyncControl from '../build/core/createAsyncControl/index.js';
import createPrimitiveControl from '../build/core/createPrimitiveControl/index.js';
import createBoundControl from '../build/core/createBoundControl/index.js';
import getValue from '../build/core/getValue/index.js';
import setValue from '../build/core/setValue/index.js';
import retain from '../build/core/retain/index.js';
import selectError from '../build/core/selectError/index.js';
import selectReady from '../build/core/selectReady/index.js';
import selectLoading from '../build/core/selectLoading/index.js';
import invalidate from '../build/core/invalidate/index.js';
import watchValue from '../build/core/watchValue/index.js';
const noop = () => {};

/** A registry whose loads answer only when the test says so. */
const controllable = (options: any = {}) => {
  const pending: Array<{
    _keys: any[];
    _handle: { setValue(v: any): void; setError(e: any): void };
  }> = [];

  const registry = createRegistry(
    createAsyncControl,
    {
      load(handle: any, keys: any) {
        pending.push({ _keys: keys, _handle: handle });
      },
    },
    options
  );

  /** Answers the load waiting for {@link key}, with a value or an error. */
  const answer = (key: any, value: any, error?: any) => {
    for (let i = 0; i < pending.length; i++) {
      if (pending[i]._keys[pending[i]._keys.length - 1] === key) {
        const { _handle: handle } = pending[i];

        pending.splice(i, 1);

        if (error) {
          handle.setError(error);
        } else {
          handle.setValue(value);
        }

        return;
      }
    }

    throw new Error(`nothing is loading for ${key}`);
  };

  return [registry, answer] as const;
};

/**
 * Created and then watched - which is what a mount is from outside, and what
 * puts a bound control's retargeting in motion.
 */
const mounted = <T>(create: () => T) => {
  const control = create();

  return [control, watchValue(control as any, noop)] as const;
};

test('a retarget keeps the previous value while the next item loads', async () => {
  const [reg, answer] = controllable({ keepPrev: true });

  const $key = createPrimitiveControl(1);

  const [$bound] = mounted(() => createBoundControl(reg, $key) as any);

  const release = retain($bound);

  answer(1, { n: 1 });

  await tick();

  assert.deepEqual(getValue($bound), { n: 1 });

  setValue($key, 2);

  await tick();

  assert.deepEqual(
    getValue($bound),
    { n: 1 },
    'the item it moved to has nothing yet, so what it showed is what it shows'
  );
  assert.equal(getValue(selectReady($bound)), true, 'and it reads as ready');
  assert.equal(getValue(selectError($bound)), undefined);

  answer(2, { n: 2 });

  await tick();

  assert.deepEqual(getValue($bound), { n: 2 }, 'until the item answers');
  assert.equal(getValue(selectLoading($bound)), false);

  release();
});

test('without keepPrev a retarget blanks until the item answers', async () => {
  const [reg, answer] = controllable();

  const $key = createPrimitiveControl(1);

  const [$bound] = mounted(() => createBoundControl(reg, $key) as any);

  const release = retain($bound);

  answer(1, { n: 1 });

  await tick();

  setValue($key, 2);

  await tick();

  assert.equal(getValue($bound), undefined, 'nothing is held');
  assert.equal(getValue(selectLoading($bound)), true);

  answer(2, { n: 2 });

  await tick();

  assert.deepEqual(getValue($bound), { n: 2 });

  release();
});

test('keepPrev per key holds on one of them and blanks on the other', async () => {
  const [reg, answer] = controllable({ keepPrev: [false, true] });

  const $a = createPrimitiveControl('x');

  const $b = createPrimitiveControl(1);

  const [$bound] = mounted(() => createBoundControl(reg, $a, $b) as any);

  const release = retain($bound);

  answer(1, { n: 1 });

  await tick();

  assert.deepEqual(getValue($bound), { n: 1 });

  // the second key keeps
  setValue($b, 2);

  await tick();

  assert.deepEqual(getValue($bound), { n: 1 }, 'kept on the second key');

  answer(2, { n: 2 });

  await tick();

  // the first key does not
  setValue($a, 'y');

  await tick();

  assert.equal(getValue($bound), undefined, 'blanked on the first');

  release();
});

test('suppressError swallows the error of an item there is a value to hold for', async () => {
  const [reg, answer] = controllable({ keepPrev: true, suppressError: true });

  const $key = createPrimitiveControl(1);

  const [$bound] = mounted(() => createBoundControl(reg, $key) as any);

  const release = retain($bound);

  answer(1, { n: 1 });

  await tick();

  setValue($key, 2);

  await tick();

  answer(2, undefined, new Error('nope'));

  await tick();

  assert.deepEqual(
    getValue($bound),
    { n: 1 },
    'the hold outlives the failure of what it moved to'
  );
  assert.equal(getValue(selectError($bound)), undefined, 'and swallows it');
  assert.equal(getValue(selectReady($bound)), true);

  release();
});

test('without suppressError the error of the item it moved to surfaces', async () => {
  const [reg, answer] = controllable({ keepPrev: true });

  const $key = createPrimitiveControl(1);

  const [$bound] = mounted(() => createBoundControl(reg, $key) as any);

  const release = retain($bound);

  answer(1, { n: 1 });

  await tick();

  setValue($key, 2);

  await tick();

  answer(2, undefined, new Error('nope'));

  await tick();

  assert.ok(getValue(selectError($bound)), 'the error is the answer');
  assert.equal(getValue($bound), undefined, 'and there is nothing to show');

  release();
});

test('an error with nothing to hold surfaces however it is configured', async () => {
  const [reg, answer] = controllable({ keepPrev: true, suppressError: true });

  const $key = createPrimitiveControl(1);

  const [$bound] = mounted(() => createBoundControl(reg, $key) as any);

  const release = retain($bound);

  answer(1, undefined, new Error('nope'));

  await tick();

  assert.ok(
    getValue(selectError($bound)),
    'suppressing is for what a value covers, and nothing does here'
  );

  release();
});

test('keepPrev holds while the key itself reloads, target and all', async () => {
  const [reg, answer] = controllable({ keepPrev: true });

  let handle: any;

  const $key: any = createAsyncControl<number>({
    load(h: any) {
      handle = h;
    },
  });

  const [$bound] = mounted(() => createBoundControl(reg, $key) as any);

  const release = retain($bound);

  handle.setValue(1);

  await tick();

  answer(1, { n: 1 });

  await tick();

  assert.deepEqual(getValue($bound), { n: 1 });

  // the key goes back to having no value, so there is no item to bind to
  invalidate($key);

  await tick();

  assert.deepEqual(
    getValue($bound),
    { n: 1 },
    'nothing to bind to is still something to show'
  );
  assert.equal(getValue(selectError($bound)), undefined);

  handle.setValue(2);

  await tick();

  answer(2, { n: 2 });

  await tick();

  assert.deepEqual(getValue($bound), { n: 2 });

  release();
});

test('a key that fails is the error, and clearing it takes the error away', async () => {
  const [reg, answer] = controllable({ keepPrev: true });

  let handle: any;

  const $key: any = createAsyncControl<number>({
    load(h: any) {
      handle = h;
    },
  });

  const [$bound] = mounted(() => createBoundControl(reg, $key) as any);

  const release = retain($bound);

  handle.setError(new Error('no key'));

  await tick();

  assert.ok(getValue(selectError($bound)), 'the key carries it up');
  assert.equal(getValue($bound), undefined, 'and there was nothing to hold');

  // the reload clears the error before it answers - the aggregate it held is
  // what the next one is compared against
  invalidate($key);

  await tick();

  assert.equal(getValue(selectError($bound)), undefined, 'cleared with it');

  handle.setValue(1);

  await tick();

  answer(1, { n: 1 });

  await tick();

  assert.deepEqual(getValue($bound), { n: 1 });

  release();
});

test('a key that fails while a value is held is what ends the hold', async () => {
  const [reg, answer] = controllable({ keepPrev: true });

  let handle: any;

  const $key: any = createAsyncControl<number>({
    load(h: any) {
      handle = h;
    },
  });

  const [$bound] = mounted(() => createBoundControl(reg, $key) as any);

  const release = retain($bound);

  handle.setValue(1);

  await tick();

  answer(1, { n: 1 });

  await tick();

  assert.deepEqual(getValue($bound), { n: 1 });

  invalidate($key);

  await tick();

  assert.deepEqual(getValue($bound), { n: 1 }, 'held while the key reloads');

  handle.setError(new Error('no key'));

  await tick();

  assert.ok(getValue(selectError($bound)), 'and let go of when it fails');
  assert.equal(getValue($bound), undefined);

  release();
});

test('two readers of one bound path read the same node', async () => {
  const [reg, answer] = controllable({});

  const $key = createPrimitiveControl(1);

  const [$bound] = mounted(() => createBoundControl(reg, $key) as any);

  const release = retain($bound);

  answer(1, { n: 1 });

  await tick();

  const first: any[] = [];

  const second: any[] = [];

  const stopFirst = watchValue($bound.n, (value: any) => {
    first.push(value);
  });

  const stopSecond = watchValue($bound.n, (value: any) => {
    second.push(value);
  });

  setValue($key, 2);

  await tick();

  answer(2, { n: 2 });

  await tick();

  assert.deepEqual(first, [2], 'the second reader is no reason to miss it');
  assert.deepEqual(second, [2]);

  stopFirst();

  stopSecond();

  release();
});

test('an aggregate that says the same thing is the same aggregate', async () => {
  const [reg] = controllable({});

  let first: any;

  let second: any;

  const $a: any = createAsyncControl<string>({
    load(h: any) {
      first = h;
    },
  });

  const $b: any = createAsyncControl<number>({
    load(h: any) {
      second = h;
    },
  });

  const [$bound] = mounted(() => createBoundControl(reg, $a, $b) as any);

  const release = retain($bound);

  first.setError(new Error('no first key'));

  await tick();

  const error = getValue(selectError($bound));

  assert.ok(error, 'the key it failed on carries it up');

  // another key answering is another commit with the same errors in it
  second.setValue(1);

  await tick();

  assert.equal(
    getValue(selectError($bound)),
    error,
    'nothing about the errors moved, so neither did the aggregate'
  );

  release();
});

test('a second key failing is a second error, and another aggregate', async () => {
  const [reg] = controllable({});

  let first: any;

  let second: any;

  const $a: any = createAsyncControl<string>({
    load(h: any) {
      first = h;
    },
  });

  const $b: any = createAsyncControl<number>({
    load(h: any) {
      second = h;
    },
  });

  const [$bound] = mounted(() => createBoundControl(reg, $a, $b) as any);

  const release = retain($bound);

  const firstError = new Error('no first key');

  first.setError(firstError);

  await tick();

  const one: any = getValue(selectError($bound));

  const secondError = new Error('no second key');

  second.setError(secondError);

  await tick();

  const both: any = getValue(selectError($bound));

  assert.notEqual(both, one, 'what it says changed, so it is another one');
  assert.deepEqual(
    [both.errors[0], both.errors[1]],
    [firstError, secondError],
    'and it says both'
  );

  release();
});
