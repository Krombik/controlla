import { tick } from './_env/dom.ts';
import assert from 'node:assert';
import test from 'node:test';
import $never from '../src/core/never/index.ts';
import createDerivedControl from '../src/core/createDerivedControl/index.ts';
import createAsyncDerivedControl from '../src/core/createAsyncDerivedControl/index.ts';
import createBoundControl from '../src/core/createBoundControl/index.ts';
import createRegistry from '../src/core/createRegistry/index.ts';
import createControl from '../src/core/createControl/index.ts';
import getValue from '../src/core/getValue/index.ts';
import retain from '../src/core/retain/index.ts';
import selectLoading from '../src/core/selectLoading/index.ts';
import selectError from '../src/core/selectError/index.ts';
import { cleanupScope } from '../src/core/_internal/cleanup.ts';
import { INTERNALS } from '../src/core/_internal/constants.ts';
import type { Subscription } from '../src/core/_internal/types.ts';

/**
 * A skeleton mounts and unmounts like anything else, so what is built over
 * `$never` has to survive that - it swallows what attaches to it rather than
 * costing a branch in the controls that attach.
 */
const cycle = <T>(create: () => T) => {
  const scope: Subscription[] = (cleanupScope._value = []);

  let control: T;

  try {
    control = create();
  } finally {
    cleanupScope._value = null;
  }

  scope[0]._subscribe();

  return {
    control,
    remount: () => {
      scope[0]._cleanup();

      scope[0]._subscribe();

      scope[0]._cleanup();
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

test('$never collects nothing from what attaches to it', () => {
  const attached = () => ($never as any)[INTERNALS]._dependents.length;

  assert.equal(attached(), 0);

  // created outside any scope, which subscribes at once and never lets go -
  // and $never is one object for the whole program
  for (let i = 0; i < 3; i++) {
    createDerivedControl($never as any, (value: any) => value);
  }

  assert.equal(attached(), 0, 'so what it holds cannot grow');
});
