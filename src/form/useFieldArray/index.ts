import { useContext, useRef } from 'react';

import type { Control, SelectValue } from '#types';
import type {
  FieldArray,
  FieldArrayOptions,
  ValidatedFieldArray,
} from '#form/types';
import type { FieldEntry } from '#form/internal/types';
import type { Mutable } from '#internal/types';
import { EMPTY_ARR } from '#internal/constants';
import setValue from '#core/setValue';
import useDerivedControl from '#core/useDerivedControl';
import FormContext from '#form/internal/FormContext';
import useEntry from '#form/internal/useEntry';
import { getFieldState } from '#form/internal/entry';

type State = {
  _control: Control;
  /** The registered field the array itself is - what carries its validator. */
  _entry: FieldEntry;
  /** The array `_keys` describes, so the next one can be told apart by length. */
  _items: readonly any[];
  _keys: number[];
  _nextKey: number;
  _derivedMapper(items: any[] | undefined): any[];
  _api: Mutable<FieldArray<any> & ValidatedFieldArray>;
};

/**
 * Both arrays are replaced rather than spliced where they are: a control
 * compares what it is handed against what it holds, and one array mutated in
 * place is both of them.
 */
const write = (state: State, items: any[], keys: number[]) => {
  state._items = items;

  state._keys = keys;

  setValue(state._control, items);
};

/**
 * Every operation that takes an array of items, and `remove`, which takes none.
 *
 * The result is the length of what is kept plus what arrives, so both arrays are
 * allocated once at that length and filled in a single pass - cloning and then
 * splicing walks each of them twice, and puts the values through an argument
 * list on the way.
 */
const splice = (
  state: State,
  index: number,
  remove: number,
  values: readonly any[]
) => {
  const prevItems = state._items;

  const prevKeys = state._keys;

  const count = prevKeys.length;

  // an index past the end appends and a count past it drops what is left of
  // the array, which is what `Array.prototype.splice` would have done
  const from = index < count ? index : count;

  const added = values.length;

  const tailFrom = from + remove;

  const tail = tailFrom < count ? count - tailFrom : 0;

  const length = from + added + tail;

  const items = Array(length);

  const keys = Array<number>(length);

  for (let i = 0; i < from; i++) {
    items[i] = prevItems[i];

    keys[i] = prevKeys[i];
  }

  for (let i = 0; i < added; i++) {
    const at = from + i;

    items[at] = values[i];

    keys[at] = state._nextKey++;
  }

  for (let i = 0; i < tail; i++) {
    const at = from + added + i;

    items[at] = prevItems[tailFrom + i];

    keys[at] = prevKeys[tailFrom + i];
  }

  write(state, items, keys);
};

const useFieldArray = ((control: Control, options?: FieldArrayOptions) => {
  const ref = useRef<State>(null);

  let state = ref.current;

  if (state === null) {
    const api: State['_api'] = {
      $keys: undefined!,
      get $error() {
        return getFieldState(self._entry).$error;
      },
      // one item lands at a known index of an array of a known length, so both
      // arrays are filled and closed in the same pass
      append(value) {
        const prevItems = self._items;

        const prevKeys = self._keys;

        const l = prevKeys.length;

        const items = Array(l + 1);

        const keys = Array<number>(l + 1);

        for (let i = 0; i < l; i++) {
          items[i] = prevItems[i];

          keys[i] = prevKeys[i];
        }

        items[l] = value;

        keys[l] = self._nextKey++;

        write(self, items, keys);
      },
      prepend(value) {
        const prevItems = self._items;

        const prevKeys = self._keys;

        const l = prevKeys.length;

        const items = Array(l + 1);

        const keys = Array<number>(l + 1);

        items[0] = value;

        keys[0] = self._nextKey++;

        for (let i = 0; i < l; i++) {
          items[i + 1] = prevItems[i];

          keys[i + 1] = prevKeys[i];
        }

        write(self, items, keys);
      },
      insert(index, value) {
        splice(self, index, 0, [value]);
      },
      // either end is the same splice with one of its two halves empty
      appendMany(values) {
        splice(self, self._keys.length, 0, values);
      },
      prependMany(values) {
        splice(self, 0, 0, values);
      },
      insertMany(index, values) {
        splice(self, index, 0, values);
      },
      remove(index, count = 1) {
        splice(self, index, count, EMPTY_ARR);
      },
      removeMany(indexes) {
        const prevItems = self._items;

        const prevKeys = self._keys;

        // one pass over both arrays: a splice per index would rewrite the tail
        // once for each of them, and shift the ones not applied yet
        const dropped = new Set(indexes);

        const items: any[] = [];

        const keys: number[] = [];

        for (let i = 0, l = prevKeys.length; i < l; i++) {
          if (!dropped.has(i)) {
            items.push(prevItems[i]);

            keys.push(prevKeys[i]);
          }
        }

        write(self, items, keys);
      },
      // nothing of the old array survives, so nothing of it is read
      replace(values) {
        const count = values.length;

        const keys = Array<number>(count);

        for (let i = 0; i < count; i++) {
          keys[i] = self._nextKey++;
        }

        write(self, values, keys);
      },
      swap(a, b) {
        const items = self._items.slice();

        const keys = self._keys.slice();

        const item = items[a];

        items[a] = items[b];

        items[b] = item;

        const key = keys[a];

        keys[a] = keys[b];

        keys[b] = key;

        write(self, items, keys);
      },
      // a drag calls this on every pointer move, so only the span it crosses
      // is touched - two splices per array would rewrite the tail twice over
      move(from, to) {
        const items = self._items.slice();

        const keys = self._keys.slice();

        const item = items[from];

        const key = keys[from];

        const step = from < to ? 1 : -1;

        for (let i = from; i != to; i += step) {
          items[i] = items[i + step];

          keys[i] = keys[i + step];
        }

        items[to] = item;

        keys[to] = key;

        write(self, items, keys);
      },
    };

    const self: State = {
      _control: control,
      _entry: undefined!,
      _items: EMPTY_ARR,
      _keys: EMPTY_ARR,
      _nextKey: 0,
      _derivedMapper(items) {
        const prevKeys = self._keys;

        const count = prevKeys.length;

        const next: readonly any[] = items || EMPTY_ARR;

        const length = next.length;

        if (length != count) {
          const keys = prevKeys.slice(0, length);

          for (let i = count; i < length; i++) {
            keys[i] = self._nextKey++;
          }

          self._keys = keys;
        }

        self._items = next;

        return self._keys;
      },
      _api: api,
    };

    ref.current = state = self;
  }

  state._control = control;

  // no rule to break means no error to hold, so an unvalidated array registers
  // nothing. The hooks below sit behind a branch that is settled for the
  // component's life - `options` is either passed or it isn't
  if (options) {
    const form = useContext(FormContext);

    // the array is a field of its own: registered while this is mounted, swept
    // by the submit, counted in `$isValid`
    const entry = useEntry(form, control);

    // read once per entry, the way a `Field`'s props are: the array keeps the
    // rule it was mounted with, and a changed control resolves to its own entry
    if (state._entry !== entry) {
      state._entry = entry;

      entry._validate = options.validate;

      entry._mode =
        options.validateOn || (form && form._options.validateOn) || 'submit';
    }
  }

  const api = state._api;

  api.$keys = useDerivedControl(control, state._derivedMapper);

  return api;
}) as {
  /**
   * Gives an array {@link control} a key per item and the operations to
   * restructure it, both at once - a key follows its item through an `insert`
   * or a `remove` instead of belonging to the index.
   *
   * A key is handed out once, from `0`, and never reused. A write from
   * anywhere else keeps the keys of the indexes it kept and gives the tail of a
   * longer array new ones - the methods here are what carries a key with its
   * item instead.
   *
   * Calls compose within a flush - each one starts from what the last one
   * wrote, not from what the control has committed - so `append` twice appends
   * twice. Which is also why adding a list of items has its own
   * `appendMany`/`prependMany`/`insertMany`: one call is one commit, where a
   * loop is one per item.
   *
   * @example
   * ```tsx
   * const $values = useControl({ tags: ['react'] });
   *
   * const { $keys, append, remove } = useFieldArray($values.tags, {
   *   validate: (tags) =>
   *     new Set(tags).size < tags.length ? 'no duplicates' : undefined,
   * });
   *
   * return (
   *   <>
   *     <ControlConsumer
   *       control={$keys}
   *       render={(keys) =>
   *         keys.map((key, index) => (
   *           <Row key={key} $tag={$values.tags[index]} onRemove={() => remove(index)} />
   *         ))
   *       }
   *     />
   *     <button onClick={() => append('')}>add</button>
   *   </>
   * );
   * ```
   */
  <C extends Control<readonly any[] | undefined>>(
    control: C
  ): FieldArray<NonNullable<SelectValue<C>>[number]>;
  /**
   * The same, and the array registers as a field of its own for as long as this
   * is mounted: {@link FieldArrayOptions.validate validate} covers what no
   * single item can answer - how many there are, whether two of them collide -
   * and blocks the submit the way any field does. The items validate
   * themselves, through whatever `Field` each row renders.
   */
  <C extends Control<readonly any[] | undefined>, E = any>(
    control: C,
    options: FieldArrayOptions<SelectValue<C>, E>
  ): FieldArray<NonNullable<SelectValue<C>>[number]> & ValidatedFieldArray<E>;
};

export default useFieldArray;
