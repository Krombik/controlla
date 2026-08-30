import { tick } from './_env/dom.ts';
import assert from 'node:assert';
import test from 'node:test';
import createAsyncControl from '../build/core/createAsyncControl/index.js';
import createAsyncDerivedControl from '../build/core/createAsyncDerivedControl/index.js';
import getValue from '../build/core/getValue/index.js';
import retain from '../build/core/retain/index.js';
import selectError from '../build/core/selectError/index.js';
import invalidate from '../build/core/invalidate/index.js';

/** Two sources whose loads answer when the test says so, and a derived of them. */
const pair = () => {
  let first: any;

  let second: any;

  const $a: any = createAsyncControl<number>({
    load(h: any) {
      first = h;
    },
  });

  const $b: any = createAsyncControl<number>({
    load(h: any) {
      second = h;
    },
  });

  const $sum: any = createAsyncDerivedControl(
    $a,
    $b,
    (a: any, b: any) => a + b
  );

  return {
    $a,
    $b,
    $sum,
    a: () => first,
    b: () => second,
  };
};

test('an error that says the same thing keeps the aggregate it made', async () => {
  const { $sum, a, b } = pair();

  const release = retain($sum);

  const failure = new Error('a failed');

  a().setError(failure);

  await tick();

  const error: any = getValue(selectError($sum));

  assert.ok(error, 'the source carries it up');

  // the other source moving is a recompute, and nothing about the errors moved
  b().setValue(5);

  await tick();

  assert.equal(
    getValue(selectError($sum)),
    error,
    'so it is the aggregate it already had'
  );

  release();
});

test('a slot that cleared is a different aggregate, identical remainder or not', async () => {
  const { $a, $sum, a, b } = pair();

  const release = retain($sum);

  const first = new Error('a failed');

  const second = new Error('b failed');

  a().setError(first);

  b().setError(second);

  await tick();

  const both: any = getValue(selectError($sum));

  assert.deepEqual([both.errors[0], both.errors[1]], [first, second]);

  // one of them recovers, the other says exactly what it said before
  invalidate($a);

  await tick();

  a().setValue(1);

  await tick();

  const left: any = getValue(selectError($sum));

  assert.notEqual(left, both, 'what it says changed, so it is another one');
  assert.deepEqual(
    [left.errors[0], left.errors[1]],
    [undefined, second],
    'and it no longer says the one that cleared'
  );

  release();
});
