import { tick } from './_env/dom.ts';
import assert from 'node:assert';
import test from 'node:test';
import $never from '../build/core/never/index.js';
import createDerivedControl from '../build/core/createDerivedControl/index.js';
import createAsyncDerivedControl from '../build/core/createAsyncDerivedControl/index.js';
import createBoundControl from '../build/core/createBoundControl/index.js';
import createRegistry from '../build/core/createRegistry/index.js';
import createControl from '../build/core/createControl/index.js';
import getValue from '../build/core/getValue/index.js';
import retain from '../build/core/retain/index.js';
import watchValue from '../build/core/watchValue/index.js';
import selectLoading from '../build/core/selectLoading/index.js';
import selectError from '../build/core/selectError/index.js';

const noop = () => {};

/**
 * A skeleton mounts and unmounts like anything else, so what is built over
 * `$never` has to survive that - it swallows what attaches to it rather than
 * costing a branch in the controls that attach.
 */
const cycle = <T>(create: () => T) => {
  const control = create();

  let unwatch = watchValue(control as any, noop);

  return {
    control,
    remount: () => {
      unwatch();

      unwatch = watchValue(control as any, noop);

      unwatch();
    },
  };
};

test('a derived over $never holds what it computed and hears nothing', () => {
  const { control: $d, remount } = cycle(() =>
    createDerivedControl($never as any, (value: any) => ['d', value])
  );

  assert.deepEqual(getValue($d), ['d', undefined]);

  remount();

  assert.deepEqual(getValue($d), ['d', undefined], 'across a mount of its own');
});

test('an async derived over $never is loading and stays that way', async () => {
  const { control: $a, remount } = cycle(() =>
    createAsyncDerivedControl($never as any, (value: any) => value)
  );

  const release = retain($a);

  await tick();

  assert.equal(getValue($a), undefined);
  assert.equal(
    getValue(selectLoading($a)),
    true,
    'what it derives never comes'
  );
  assert.equal(getValue(selectError($a)), undefined, 'and is no error either');

  release();

  remount();
});

test('a bound control keyed by $never binds to nothing', () => {
  const reg = createRegistry(createControl, (id: number) => ({ n: id }));

  const { control: $b, remount } = cycle(
    () => createBoundControl(reg, $never as any) as any
  );

  assert.equal(getValue($b), undefined, 'a key with nothing in it is no item');
  assert.equal(getValue(selectLoading($b)), true);

  remount();
});

test('$never swallows everything that attaches to it', () => {
  // $never is one object for the whole program, so what attaches to it must
  // not accumulate. How much it is holding is not observable from outside -
  // what is, is that attaching over and over keeps behaving the same
  for (let i = 0; i < 3; i++) {
    const { control: $d, remount } = cycle(() =>
      createDerivedControl($never as any, (value: any) => ['d', value, i])
    );

    assert.deepEqual(getValue($d), ['d', undefined, i]);

    remount();

    assert.deepEqual(getValue($d), ['d', undefined, i], 'after its own mount');
  }
});
