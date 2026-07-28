// the env module must come first: it installs the browser mocks
import { tick } from './_env/dom.ts';
import assert from 'node:assert';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';

// every assertion here forces a collection, without asking the runner for
// `--expose-gc` - the flag would have to be repeated in every ci workflow
setFlagsFromString('--expose-gc');

const gc = runInNewContext('gc') as () => void;

setFlagsFromString('--no-expose-gc');

const { default: createControl } =
  await import('../build/core/createControl/index.js');
const { default: createDerivedControl } =
  await import('../build/core/createDerivedControl/index.js');
const { default: createRegistry } =
  await import('../build/core/createRegistry/index.js');
const { default: watchValue } =
  await import('../build/core/watchValue/index.js');
const { default: watchValues } =
  await import('../build/core/watchValues/index.js');
import setValue from '../build/core/setValue/index.js';
import getValue from '../build/core/getValue/index.js';

const collect = async () => {
  for (let i = 0; i < 20; i++) {
    gc();

    await tick();
  }
};

// a dependent reaches its source only through a WeakRef and keeps values rather
// than controls, so an intermediate control nobody stored must still be held
{
  const reg = createRegistry(createControl, (key: string[]) => ({
    addr: key[0],
  }));
  const $q = createControl('paris');
  // the key control is inline - the bound control is all that references it
  const $bound = reg.bind(createDerivedControl($q, (q: string) => [q])) as any;
  const $nested = createDerivedControl(
    createDerivedControl($q, (q: string) => q.toUpperCase()),
    (s: string) => `<${s}>`
  );
  const relBound = watchValue($bound, () => {});
  const relNested = watchValue($nested, () => {});
  await tick();

  await collect();

  setValue($q, 'london');
  await tick();
  assert.deepEqual(
    getValue($bound),
    { addr: 'london' },
    'inline bind key survived gc'
  );
  assert.equal(getValue($nested), '<LONDON>', 'inline source survived gc');

  relBound();
  relNested();
}

// a collected dependent must not take a live sibling out of `_dependents` with
// it: the sibling still gets that one notify, then goes silent forever
{
  const $src = createControl({ items: [1] });
  const holder: any = {
    a: createDerivedControl($src.items.length, (l: number) => `a${l}`),
    b: createDerivedControl($src.items.length, (l: number) => `b${l}`),
    c: createDerivedControl($src.items.length, (l: number) => `c${l}`),
  };

  holder.a = undefined;

  await collect();

  // the dropped sibling is still notified in this very pass
  setValue($src, { items: [1, 2, 3] });
  await tick();

  // by now it is gone from `_dependents`
  setValue($src, { items: [1, 2, 3, 4, 5] });
  await tick();

  assert.equal(getValue(holder.b), 'b5', 'sibling b stayed subscribed');
  assert.equal(getValue(holder.c), 'c5', 'sibling c stayed subscribed');
}

// a subscription has no owner to outlive, so it lives until unwatch even when
// the caller drops the returned unsubscribe
{
  const $q = createControl('paris');
  const seen: string[] = [];

  (() => {
    watchValues([$q], ([q]: [string]) => void seen.push(q));
  })();

  await collect();

  setValue($q, 'london');
  await tick();
  assert.deepEqual(seen, ['london'], 'dropped unsubscribe kept watching');
}

// ...but unwatch must still release it, or an unwatched subscription would pin
// its callback to a long-lived control forever
{
  const $q = createControl('paris');
  const freed: string[] = [];
  const registry = new FinalizationRegistry((tag: string) => freed.push(tag));

  for (let i = 0; i < 20; i++) {
    ((index: number) => {
      const callback = () => {};

      registry.register(callback, `cb${index}`);

      watchValues([$q], callback)();
    })(i);
  }

  await collect();

  assert.ok(freed.length >= 15, `unwatch released ${freed.length}/20`);
}

// detach clears `_source`, so a consumer kept alive after unwatch releases it
{
  const freed: string[] = [];
  const registry = new FinalizationRegistry((tag: string) => freed.push(tag));
  const held: Array<() => void> = [];

  (() => {
    const $src = createControl('paris');

    registry.register($src, 'src');

    const unwatch = watchValue($src, () => {});

    held.push(unwatch);

    unwatch();
  })();

  await collect();

  assert.deepEqual(freed, ['src'], 'detach released the source');
  assert.equal(held.length, 1);
}

console.log('gc.test.ts: all assertions passed');
