import { tick } from './_env/dom.ts';
import assert from 'node:assert';
import test from 'node:test';

import { renderHook } from './_env/hooks.ts';
import createControl from '../build/core/createControl/index.js';
import getValue from '../build/core/getValue/index.js';
import setValue from '../build/core/setValue/index.js';
import useFieldArray from '../build/form/useFieldArray/index.js';
import usePathValidator from '../build/form/usePathValidator/index.js';
import type { ControlErrors } from '../build/form/types.js';
import { mountForm } from './_env/form.ts';

const noop = () => {};

const makeArray = (control: any) =>
  renderHook(() => useFieldArray(control)).result;

test('the rows that duplicate are the ones the validator marks', async () => {
  const $values = createControl({ tags: ['a', 'b', 'a'] });

  const { form, result } = await mountForm(
    $values,
    { submit: noop },
    () =>
      [
        useFieldArray($values.tags),
        usePathValidator($values.tags, (tags: string[]) => {
          const seen = new Map<string, number>();

          const errors: ControlErrors<string> = [];

          for (let i = 0; i < tags.length; i++) {
            const at = seen.get(tags[i]);

            if (at !== undefined) {
              errors.push([$values.tags[at], 'duplicate']);

              errors.push([$values.tags[i], 'duplicate']);
            } else {
              seen.set(tags[i], i);
            }
          }

          return errors;
        }),
      ] as const
  );

  const [array, errorOf] = result;

  assert.equal(await form.validate(), false);
  assert.equal(getValue(form.$isValid), false);
  // the duplicating rows, not the array and not the row between them
  assert.equal(getValue(errorOf($values.tags[0])), 'duplicate');
  assert.equal(getValue(errorOf($values.tags[1])), undefined);
  assert.equal(getValue(errorOf($values.tags[2])), 'duplicate');

  array.remove(0);

  await tick();

  assert.equal(await form.validate(), true);
  assert.equal(getValue(errorOf($values.tags[0])), undefined);
  assert.equal(getValue(errorOf($values.tags[2])), undefined);
});

test('keys start at 0, follow their items, and are never reused', async () => {
  const $tags = createControl(['a', 'b', 'c']);

  const fieldArray = makeArray($tags);

  const { $keys } = fieldArray;

  assert.deepEqual(getValue($keys), [0, 1, 2]);

  fieldArray.remove(0);

  await tick();

  assert.deepEqual(getValue($tags), ['b', 'c']);
  assert.deepEqual(getValue($keys), [1, 2]);

  fieldArray.prepend('z');

  await tick();

  assert.deepEqual(getValue($tags), ['z', 'b', 'c']);
  // the freed 0 stays freed - a key coming back could collide with a row
  // React hasn't finished removing
  assert.deepEqual(getValue($keys), [3, 1, 2]);

  fieldArray.insert(2, 'y');

  await tick();

  assert.deepEqual(getValue($tags), ['z', 'b', 'y', 'c']);
  assert.deepEqual(getValue($keys), [3, 1, 4, 2]);
});

test('calls in one flush start from what the last one wrote', async () => {
  const $tags = createControl(['a']);

  const fieldArray = makeArray($tags);

  fieldArray.append('b');

  fieldArray.append('c');

  fieldArray.remove(0);

  await tick();

  assert.deepEqual(getValue($tags), ['b', 'c']);
  assert.deepEqual(getValue(fieldArray.$keys), [1, 2]);
});

test('an index or a count past the end is taken as far as it goes', async () => {
  const $tags = createControl(['a', 'b', 'c']);

  const fieldArray = makeArray($tags);

  fieldArray.insert(9, 'd');

  await tick();

  assert.deepEqual(getValue($tags), ['a', 'b', 'c', 'd']);
  assert.deepEqual(getValue(fieldArray.$keys), [0, 1, 2, 3]);

  fieldArray.remove(1, 99);

  await tick();

  assert.deepEqual(getValue($tags), ['a']);
  assert.deepEqual(getValue(fieldArray.$keys), [0]);
});

test('the many variants take a whole array, keyed like one call each', async () => {
  const $tags = createControl(['b']);

  const fieldArray = makeArray($tags);

  fieldArray.appendMany(['c', 'd']);

  fieldArray.prependMany(['a']);

  fieldArray.insertMany(2, ['x', 'y']);

  await tick();

  assert.deepEqual(getValue($tags), ['a', 'b', 'x', 'y', 'c', 'd']);
  assert.deepEqual(getValue(fieldArray.$keys), [3, 0, 4, 5, 1, 2]);
});

test('removeMany takes a list of indexes, in any order', async () => {
  const $tags = createControl(['a', 'b', 'c', 'd']);

  const fieldArray = makeArray($tags);

  fieldArray.removeMany([2, 0, 2, 9]);

  await tick();

  assert.deepEqual(getValue($tags), ['b', 'd']);
  assert.deepEqual(getValue(fieldArray.$keys), [1, 3]);
});

test('swap and move take the keys with them', async () => {
  const $tags = createControl(['a', 'b', 'c']);

  const fieldArray = makeArray($tags);

  fieldArray.swap(0, 2);

  await tick();

  assert.deepEqual(getValue($tags), ['c', 'b', 'a']);
  assert.deepEqual(getValue(fieldArray.$keys), [2, 1, 0]);

  fieldArray.move(2, 0);

  await tick();

  assert.deepEqual(getValue($tags), ['a', 'c', 'b']);
  assert.deepEqual(getValue(fieldArray.$keys), [0, 2, 1]);
});

test('a write from outside keeps the keys of the indexes it kept', async () => {
  const a = { name: 'a' };

  const b = { name: 'b' };

  const c = { name: 'c' };

  const $rows = createControl([a, b, c]);

  const fieldArray = makeArray($rows);

  assert.deepEqual(getValue(fieldArray.$keys), [0, 1, 2]);

  // a reorder is indistinguishable from a rewrite out here, so neither moves
  // a key - only the length is answered
  setValue($rows, [c, a]);

  await tick();

  assert.deepEqual(getValue(fieldArray.$keys), [0, 1]);

  setValue($rows, [c, a, b, { name: 'd' }]);

  await tick();

  assert.deepEqual(getValue(fieldArray.$keys), [0, 1, 3, 4]);
});

test('replace hands every row a new key', async () => {
  const $tags = createControl(['a', 'b']);

  const fieldArray = makeArray($tags);

  assert.deepEqual(getValue(fieldArray.$keys), [0, 1]);

  fieldArray.replace(['x', 'y', 'z']);

  await tick();

  assert.deepEqual(getValue($tags), ['x', 'y', 'z']);
  assert.deepEqual(getValue(fieldArray.$keys), [2, 3, 4]);

  fieldArray.replace([]);

  await tick();

  assert.deepEqual(getValue($tags), []);
  assert.deepEqual(getValue(fieldArray.$keys), []);
});

test('a control swapped under it catches the keys up to the new one', () => {
  const $rows = createControl([{ items: ['a', 'b'] }, { items: ['c'] }]);

  let control: any = $rows[1].items;

  // the row a removal shifted down renders the same instance over a different
  // control - the keys carry over and the length is answered
  const { render, result } = renderHook(() => useFieldArray(control));

  assert.deepEqual(getValue(result.$keys), [0]);

  control = $rows[0].items;

  render();

  assert.deepEqual(getValue(result.$keys), [0, 1]);
});

test('a nested edit leaves every key where it was', async () => {
  const $rows = createControl([{ name: 'a' }, { name: 'b' }]);

  const fieldArray = makeArray($rows);

  const keys = getValue(fieldArray.$keys);

  setValue($rows[0].name, 'aa');

  await tick();

  // the same array, not an equal one: the list around the row is untouched
  assert.equal(getValue(fieldArray.$keys), keys);
});

test('a removal through the method carries the keys, not the indexes', async () => {
  const $tags = createControl(['a', 'b', 'c']);

  const fieldArray = makeArray($tags);

  fieldArray.remove(0);

  await tick();

  // the same write from outside would have left [0, 1]
  assert.deepEqual(getValue(fieldArray.$keys), [1, 2]);

  setValue($tags, ['b']);

  await tick();

  assert.deepEqual(getValue(fieldArray.$keys), [1]);
});

/** Never called - `tsc` is the assertion. */
export const typeChecks = () => {
  const $tags = createControl(['a']);

  // @ts-expect-error an array validates through a validator of its own now
  useFieldArray($tags, { validate: (tags: string[]) => tags.length });
};
