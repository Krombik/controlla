// the env module must come first: it installs the browser mocks
import { tick } from './_env/dom.ts';
import assert from 'node:assert';
import test from 'node:test';

import createControl from '../src/core/createControl/index.ts';
import createAsyncControl from '../src/core/createAsyncControl/index.ts';
import getValue from '../src/core/getValue/index.ts';
import setValue from '../src/core/setValue/index.ts';
import invalidate from '../src/core/invalidate/index.ts';
import watchValue from '../src/core/watchValue/index.ts';
import makeForm from '../src/form/_internal/makeForm.ts';
import {
  getEntry,
  getFieldState,
  snapshotOf,
} from '../src/form/_internal/entry.ts';
import { getKind, setElement } from '../src/form/_internal/native.ts';
import isNotEqual from '../src/form/_internal/isNotEqual.ts';
import createDebounceScheduler from '../src/scheduler/createDebounceScheduler/index.ts';
import noop from '../src/core/_internal/noop.ts';
import NativeField from '../src/form/NativeField/index.ts';
import type { FormOptions } from '../src/form/types.ts';
import type { Control } from '../src/core/types.ts';

/** Enough of an input for the element wiring — no DOM involved. */
const fakeInput = (position = 0, type?: string) => {
  const listeners: Record<string, Array<() => void>> = {};

  return {
    value: '',
    checked: false,
    tagName: 'INPUT',
    isConnected: true,
    type,
    position,
    selectionStart: null as number | null,
    selectionEnd: null as number | null,
    setSelectionRange(start: number, end: number) {
      this.selectionStart = start;

      this.selectionEnd = end;
    },
    focused: false,
    addEventListener(type: string, listener: () => void) {
      (listeners[type] ||= []).push(listener);
    },
    removeEventListener(type: string, listener: () => void) {
      listeners[type] = (listeners[type] || []).filter((it) => it !== listener);
    },
    focus() {
      this.focused = true;
    },
    compareDocumentPosition(other: { position: number }) {
      return other.position < position ? 2 : 4;
    },
    emit(type: string, event?: any) {
      const it = {
        target: this,
        preventDefault: () => (it.defaultPrevented = true),
        defaultPrevented: false,
        ...event,
      };

      (listeners[type] || []).forEach((listener: any) => listener(it));

      return it;
    },
  };
};

/** Stands in for a mounted `Field`, which writes these on every render. */
const register = (
  form: ReturnType<typeof makeForm>,
  control: any,
  validate?: (value: any) => any
) => {
  const entry = getEntry(form, control);

  entry._validate = validate;

  entry._refs++;

  return entry;
};

const createForm = (
  control: any,
  options: Partial<FormOptions> = {}
): ReturnType<typeof makeForm> =>
  makeForm(control, { submit: noop, ...options });

test('submit runs the handler only when every validator passed', async () => {
  const $values = createControl({ email: '', age: 0 });

  const submitted: Array<{ email: string; age: number }> = [];

  const form = createForm($values, {
    submit(values: any) {
      submitted.push(values);
    },
  });

  register(form, $values.email, (email: string) =>
    email.includes('@') ? undefined : 'invalid'
  );

  register(form, $values.age);

  await form.submit();

  assert.deepEqual(submitted, []);
  assert.equal(getValue(form.$isValid), false);

  setValue($values.email, 'a@b.c');

  await tick();

  await form.submit();

  assert.deepEqual(submitted, [{ email: 'a@b.c', age: 0 }]);
  assert.equal(getValue(form.$isValid), true);
  assert.equal(getValue(form.$isSubmitting), false);
});

test('dirty tracks the baseline captured at registration, reset restores it', async () => {
  const $values = createControl({ user: { name: 'jane', age: 30 } });

  const form = createForm($values);

  register(form, $values.user.name);

  const { $isDirty } = form;

  assert.equal(getValue($isDirty), false);

  setValue($values.user.name, 'john');

  await tick();

  assert.equal(getValue($isDirty), true);

  // a parent registering later baselines against the same moment
  const parent = register(form, $values.user);

  assert.deepEqual(snapshotOf(parent), { name: 'jane', age: 30 });

  form.reset();

  await tick();

  assert.equal(getValue($values.user.name), 'jane');
  assert.equal(getValue($isDirty), false);
});

test('a stale async validation never writes its error', async () => {
  const $values = createControl({ name: '' });

  const form = createForm($values);

  const resolvers: Array<(error: string | undefined) => void> = [];

  const entry = register(
    form,
    $values.name,
    () => new Promise<string | undefined>((resolve) => resolvers.push(resolve))
  );

  const { $isValidating } = form;

  const stale = form.validate();

  const fresh = form.validate();

  await tick();

  assert.equal(getValue($isValidating), true);

  // the superseded run answers last and must be ignored
  resolvers[1]('taken');

  resolvers[0](undefined);

  assert.equal(await stale, false);
  assert.equal(await fresh, false);

  assert.equal(entry._error, 'taken');

  await tick();

  assert.equal(getValue($isValidating), false);
});

test('an uncontrolled field lets the element own the value both ways', async () => {
  const $values = createControl({ name: 'jane' });

  const form = createForm($values);

  const entry = register(form, $values.name);

  entry._native = getKind('text');

  const input = fakeInput();

  setElement(entry, input as unknown as HTMLElement);

  assert.equal(input.value, 'jane');

  const writes: string[] = [];

  const unwatch = watchValue($values.name, (value) => {
    writes.push(value);
  });

  input.value = 'john';

  input.emit('input');

  // autofill is why `change` is listened to as well, and it repeats what
  // `input` just delivered
  input.emit('change');

  await tick();

  assert.equal(getValue($values.name), 'john');
  assert.deepEqual(writes, ['john']);

  unwatch();

  setValue($values.name, 'jack');

  await tick();

  assert.equal(input.value, 'jack');

  input.isConnected = false;

  setElement(entry, null);

  setValue($values.name, 'jill');

  await tick();

  assert.equal(input.value, 'jack');
});

test('a failed submit focuses the invalid field first in the document', async () => {
  const $values = createControl({ first: '', second: '' });

  const form = createForm($values, {
    submit() {
      throw new Error('submitted an invalid form');
    },
  });

  const invalid = () => 'bad';

  // registered last but standing first in the document
  const later = register(form, $values.second, invalid);

  const earlier = register(form, $values.first, invalid);

  const laterInput = fakeInput(5);

  const earlierInput = fakeInput(1);

  // a controlled `Field` only records the element, it binds nothing
  later._element = laterInput as unknown as HTMLElement;

  earlier._element = earlierInput as unknown as HTMLElement;

  await form.submit();

  assert.equal(earlierInput.focused, true);
  assert.equal(laterInput.focused, false);
});

test('isNotEqual walks structurally without recursing', () => {
  const equal = (a: any, b: any) => assert.equal(isNotEqual(a, b), false);

  const notEqual = (a: any, b: any) => assert.equal(isNotEqual(a, b), true);

  equal(1, 1);
  equal(undefined, undefined);
  equal({ a: { b: [1, { c: 'x' }] } }, { a: { b: [1, { c: 'x' }] } });
  equal(new Date(5), new Date(5));
  equal([], []);
  equal(NaN, NaN);
  equal({ a: NaN }, { a: NaN });
  // an explicit `undefined` is the same as a missing key
  equal({ a: undefined }, { b: undefined });
  equal({ a: undefined }, {});
  equal({ a: 1, b: undefined }, { a: 1 });

  notEqual(1, '1');
  notEqual(null, undefined);
  notEqual(null, {});
  notEqual({ a: 1 }, { a: 1, b: 2 });
  notEqual({ a: 1 }, { b: 1 });
  notEqual([1, 2], [1, 2, 3]);
  notEqual({ a: { b: [1, { c: 'x' }] } }, { a: { b: [1, { c: 'y' }] } });
  notEqual(new Date(5), new Date(6));
  notEqual(NaN, 0);
  notEqual({ a: undefined }, { a: 1 });
  notEqual({ a: 1, b: undefined }, { a: 1, b: 2 });
  notEqual([1], { 0: 1 });

  let deep: any = 0;

  let other: any = 0;

  for (let i = 0; i < 20000; i++) {
    deep = { next: deep };

    other = { next: other };
  }

  equal(deep, other);

  notEqual(deep, { next: other });
});

test('a scheduler holds the element writes back without holding the typing', async () => {
  const $filters = createControl({ name: '', cheap: false });

  const form = createForm($filters);

  const scheduler = createDebounceScheduler(50);

  const name = register(form, $filters.name);

  name._native = getKind('text');

  name._scheduler = scheduler;

  const input = fakeInput();

  setElement(name, input as unknown as HTMLElement);

  const cheap = register(form, $filters.cheap);

  cheap._native = getKind('checkbox');

  const box = fakeInput(0, 'checkbox');

  setElement(cheap, box as unknown as HTMLElement);

  input.value = 'ph';

  input.emit('input');

  input.value = 'pho';

  input.emit('input');

  box.checked = true;

  box.emit('input');

  await tick();

  // the checkbox beside it applies at its own pace
  assert.equal(getValue($filters.cheap), true);
  assert.equal(getValue($filters.name), '');
  // what was typed is on the element the whole time, only the commit waits
  assert.equal(input.value, 'pho');

  scheduler.flush();

  await tick();

  assert.equal(getValue($filters.name), 'pho');
});

test('the element type picks how a value is written back', async () => {
  const $values = createControl({ agreed: false, tags: ['a'] });

  const form = createForm($values);

  const entry = register(form, $values.agreed);

  entry._native = getKind('checkbox');

  const box = fakeInput(0, 'checkbox');

  setElement(entry, box as unknown as HTMLElement);

  assert.equal(box.checked, false);
  // a boolean must never land on `value`
  assert.equal(box.value, '');

  setValue($values.agreed, true);

  await tick();

  assert.equal(box.checked, true);

  box.checked = false;

  box.emit('change');

  await tick();

  assert.equal(getValue($values.agreed), false);

  const select: any = fakeInput(1);

  select.tagName = 'SELECT';

  select.multiple = true;

  select.options = [{ value: 'a' }, { value: 'b' }];

  const tags = register(form, $values.tags);

  tags._native = getKind('multiselect');

  setElement(tags, select as unknown as HTMLElement);

  assert.deepEqual(
    select.options.map((it: any) => it.selected),
    [true, false]
  );
});

test('a rewrite while typing keeps the caret off the end', async () => {
  const $values = createControl({ name: 'abcdef', age: '' });

  const form = createForm($values);

  const entry = register(form, $values.name);

  entry._native = getKind('text');

  const input = fakeInput();

  setElement(entry, input as unknown as HTMLElement);

  input.selectionStart = input.selectionEnd = 3;

  // length kept: the caret stays where it was
  setValue($values.name, 'ABCDEF');

  await tick();

  assert.equal(input.value, 'ABCDEF');
  assert.equal(input.selectionStart, 3);

  // two characters dropped before the caret
  setValue($values.name, 'ABCD');

  await tick();

  assert.equal(input.selectionStart, 1);

  // a type without a text cursor is left alone
  const number: any = fakeInput(0, 'number');

  const age = register(form, $values.age);

  age._native = getKind('text');

  setElement(age, number as unknown as HTMLElement);

  setValue($values.age, '5');

  await tick();

  assert.equal(number.selectionStart, null);
});

test('a numeric field parses what it reads and refuses what it cannot', async () => {
  const $values = createControl({ amount: NaN });

  const form = createForm($values);

  const entry = register(form, $values.amount);

  entry._native = getKind('decimal');

  const input = fakeInput(0, 'text');

  setElement(entry, input as unknown as HTMLElement);

  // NaN writes an empty field, not the string 'NaN'
  assert.equal(input.value, '');

  // a decimal keypad emits the locale separator
  input.value = '1,5';

  input.emit('input');

  await tick();

  assert.equal(getValue($values.amount), 1.5);

  // '-' on its own is a state the field passes through, not a number
  input.value = '-';

  input.emit('input');

  await tick();

  assert.equal(Number.isNaN(getValue($values.amount)), true);

  input.value = '';

  input.emit('input');

  await tick();

  // an empty field is NaN, never the 0 that `+''` would give
  assert.equal(Number.isNaN(getValue($values.amount)), true);

  input.value = '12';

  input.selectionStart = input.selectionEnd = 2;

  assert.equal(
    input.emit('beforeinput', { data: '3' }).defaultPrevented,
    false
  );
  assert.equal(input.emit('beforeinput', { data: 'a' }).defaultPrevented, true);
  assert.equal(
    input.emit('beforeinput', { data: '.' }).defaultPrevented,
    false
  );
  // a second separator would leave it unreadable
  input.value = '1.2';
  input.selectionStart = input.selectionEnd = 3;
  assert.equal(input.emit('beforeinput', { data: '.' }).defaultPrevented, true);
});

test('a radio group is read and written through the DOM group', async () => {
  const $values = createControl({ plan: 'free' });

  const form = createForm($values);

  const entry = register(form, $values.plan);

  entry._native = getKind('radio');

  // a RadioNodeList has no tagName, which is how a lone radio is told apart
  const group: any = {
    value: 'free',
  };

  const first = fakeInput(0, 'radio');

  const second = fakeInput(1, 'radio');

  const formNode = {
    elements: {
      namedItem: (name: string) => (name === 'plan' ? group : null),
    },
  };

  Object.assign(first, { form: formNode, name: 'plan' });

  Object.assign(second, { form: formNode, name: 'plan' });

  setElement(entry, first as unknown as HTMLElement);

  setElement(entry, second as unknown as HTMLElement);

  // the field holds the first, and reaches the group through it
  assert.equal(entry._element, first);

  group.value = 'pro';

  second.emit('change');

  await tick();

  assert.equal(getValue($values.plan), 'pro');

  setValue($values.plan, 'free');

  await tick();

  assert.equal(group.value, 'free');
});

test('reset reaches a path no field is mounted on, and takes a value', async () => {
  const $values = createControl({
    user: { name: 'jane', age: 30 },
    hidden: 'kept',
  });

  const form = createForm($values);

  // only one field ever registers; the rest is covered by the form control
  register(form, $values.user.name);

  setValue($values.user.name, 'john');

  setValue($values.hidden, 'edited');

  await tick();

  form.reset();

  await tick();

  assert.equal(getValue($values.user.name), 'jane');
  // the unmounted path is restored too
  assert.equal(getValue($values.hidden), 'kept');

  // a subtree on its own
  setValue($values.user.name, 'jack');

  setValue($values.hidden, 'edited');

  await tick();

  form.reset($values.user);

  await tick();

  assert.equal(getValue($values.user.name), 'jane');
  assert.equal(getValue($values.hidden), 'edited');

  // given a value, it becomes the new baseline
  form.reset($values.user.name, 'joan');

  await tick();

  assert.equal(getValue($values.user.name), 'joan');

  const { $isDirty } = form;

  setValue($values.hidden, 'kept');

  await tick();

  assert.equal(getValue($isDirty), false);
});

test('reset tells restoring from writing undefined by the argument count', async () => {
  const $values = createControl<{ note: string | undefined }>({
    note: 'initial',
  });

  const form = createForm($values);

  register(form, $values.note);

  setValue($values.note, 'edited');

  await tick();

  form.reset($values.note, undefined);

  await tick();

  assert.equal(getValue($values.note), undefined);

  form.reset($values.note);

  await tick();

  // undefined was written as a value, so it is what restoring returns to
  assert.equal(getValue($values.note), undefined);
});

test('a submit that went through becomes the new baseline', async () => {
  const $values = createControl({ name: 'jane' });

  let release: () => void;

  const form = createForm($values, {
    submit: () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  });

  register(form, $values.name);

  const { $isDirty } = form;

  setValue($values.name, 'john');

  await tick();

  assert.equal(getValue($isDirty), true);

  const submitting = form.submit();

  // let it get past the validator sweep and into the handler
  await tick();

  // an edit made while the submit is in flight isn't what was submitted
  setValue($values.name, 'joan');

  await tick();

  release!();

  await submitting;

  assert.equal(getValue($isDirty), true);

  form.reset();

  await tick();

  assert.equal(getValue($values.name), 'john');
  assert.equal(getValue($isDirty), false);
});

test('a field is dirty against the baseline, not against its own last value', async () => {
  const $values = createControl({ name: 'jane', note: '' });

  const form = createForm($values);

  const name = getFieldState(register(form, $values.name));

  const note = getFieldState(register(form, $values.note));

  assert.equal(getValue(name.$isDirty), false);

  setValue($values.name, 'john');

  await tick();

  assert.equal(getValue(name.$isDirty), true);
  assert.equal(getValue(note.$isDirty), false);

  // the value doesn't move here, only what it is compared against
  await form.submit();

  await tick();

  assert.equal(getValue(name.$isDirty), false);
  assert.equal(getValue(form.$isDirty), false);

  // reset to a value of its own baselines it to itself
  form.reset($values.name, 'joan');

  await tick();

  assert.equal(getValue($values.name), 'joan');
  assert.equal(getValue(name.$isDirty), false);
});

test('submit says which of its own paths moved since the last one', async () => {
  const $data = createControl({
    settings: { alerts: false, digest: false },
  });

  const $foreign = createControl({ note: '' });

  const changed: string[][] = [];

  const form = createForm($data.settings, {
    submit(_values: any, paths: string[]) {
      changed.push(paths);
    },
  });

  register(form, $data.settings.alerts);

  register(form, $data.settings.digest);

  register(form, $foreign.note);

  setValue($data.settings.alerts, true);

  setValue($foreign.note, 'edited');

  await tick();

  await form.submit();

  // the foreign field isn't in the submitted value, so there is nothing of it
  // to patch
  assert.deepEqual(changed, [['alerts']]);

  setValue($data.settings.digest, true);

  await tick();

  await form.submit();

  // the first submit rebaselined, so `alerts` is no longer something that moved
  assert.deepEqual(changed[1], ['digest']);
});

test('an async control is baselined by the value it was waiting for', async () => {
  const $values = createAsyncControl<{ name: string }>();

  const changed: string[][] = [];

  const form = createForm($values, {
    submit(_values: any, paths: string[]) {
      changed.push(paths);
    },
  });

  register(form, $values.name);

  // the form was made before the load landed, so the baseline is owed - and
  // dirtiness is tracked from before it arrives
  assert.equal(getValue(form.$isDirty), false);

  setValue($values, { name: 'jane' });

  await tick();

  assert.equal(
    getValue(form.$isDirty),
    false,
    'the value it was waiting for is not a change to it'
  );

  setValue($values.name, 'john');

  await tick();

  assert.equal(getValue(form.$isDirty), true);

  await form.submit();

  assert.deepEqual(changed, [['name']]);
});

test('a reload takes the baseline with it, loud or silent', async () => {
  const $values = createAsyncControl<{ name: string }>();

  const changed: string[][] = [];

  const form = createForm($values, {
    submit(_values: any, paths: string[]) {
      changed.push(paths);
    },
  });

  register(form, $values.name);

  setValue($values, { name: 'jane' });

  await tick();

  setValue($values.name, 'john');

  await tick();

  assert.equal(getValue(form.$isDirty), true);

  // silent: the edit stands until the reload answers
  invalidate($values, true);

  setValue($values, { name: 'joan' });

  await tick();

  assert.equal(getValue($values.name), 'joan');
  assert.equal(
    getValue(form.$isDirty),
    false,
    'what the reload brought is the baseline'
  );

  await form.submit();

  assert.deepEqual(changed, [[]]);

  setValue($values.name, 'jack');

  await tick();

  assert.equal(getValue(form.$isDirty), true);

  // loud: the value goes first, the reload brings the next one
  invalidate($values);

  await tick();

  setValue($values, { name: 'jane' });

  await tick();

  assert.equal(getValue(form.$isDirty), false, 'a loud reload the same');
});

test('the paths are not collected for a submit that never asked', async () => {
  const $data = createControl({ alerts: false });

  let passed: any;

  const form = createForm($data, {
    submit(_values: any) {
      passed = arguments[1];
    },
  });

  register(form, $data.alerts);

  setValue($data.alerts, true);

  await tick();

  await form.submit();

  assert.deepEqual(passed, []);
});

test('resetValue is where a reset with no value of its own goes', async () => {
  const $values = createControl({ query: 'from url', page: 2 });

  const form = createForm($values, {
    resetValue: { query: '', page: 1 },
  });

  register(form, $values.query);

  const { $isDirty } = form;

  // the url values are the baseline, so nothing starts dirty
  assert.equal(getValue($isDirty), false);

  form.reset($values.query);

  await tick();

  assert.equal(getValue($values.query), '');
  // a single field's reset leaves the rest alone
  assert.equal(getValue($values.page), 2);

  form.reset();

  await tick();

  assert.deepEqual(getValue($values), { query: '', page: 1 });
  // what a reset wrote is the new baseline, whichever tree it came from
  assert.equal(getValue($isDirty), false);
});

test('submitFailed runs instead of submit, with the errors that stopped it', async () => {
  const $values = createControl({ email: '', name: '' });

  const failures: any[] = [];

  const form = createForm($values, {
    submit() {
      throw new Error('submitted an invalid form');
    },
    submitFailed(errors) {
      failures.push(errors);
    },
  });

  register(form, $values.email, () => 'invalid email');

  register(form, $values.name);

  await form.submit();

  assert.equal(failures.length, 1);
  assert.deepEqual(failures[0], [
    { control: $values.email, error: 'invalid email' },
  ]);

  form.reset();

  await tick();

  assert.equal(getValue(form.$isValid), true);
});

test('aria lands on the element without a rerender, and shares describedby', async () => {
  const $values = createControl({ email: '' });

  const form = createForm($values);

  const attributes: Record<string, string> = {};

  const input = Object.assign(fakeInput(0, 'text'), {
    setAttribute(name: string, value: string) {
      attributes[name] = value;
    },
    getAttribute: (name: string) => attributes[name] ?? null,
    removeAttribute(name: string) {
      delete attributes[name];
    },
  });

  const entry = register(form, $values.email, () => 'invalid');

  entry._native = getKind('text');

  entry._errorId = 'email-error';

  entry._describedBy = 'hint';

  setElement(entry, input as unknown as HTMLElement);

  assert.equal(attributes['aria-invalid'], undefined);
  assert.equal(attributes['aria-describedby'], 'hint');

  await form.validate();

  assert.equal(attributes['aria-invalid'], 'true');
  // the field composes what describes it with the error it now holds
  assert.equal(attributes['aria-describedby'], 'hint email-error');

  // a validator dropped without passing leaves the error alone, so it has to
  // actually pass for the attributes to come back off
  entry._validate = () => undefined;

  await form.validate();

  assert.equal(attributes['aria-invalid'], undefined);
  assert.equal(attributes['aria-describedby'], 'hint');
});

test('isSubmitting flips even when nothing about the submit is async', async () => {
  const $values = createControl({ name: 'jane' });

  const form = createForm($values, {
    submit() {},
  });

  register(form, $values.name, () => undefined);

  const seen: boolean[] = [];

  watchValue(form.$isSubmitting, (value) => {
    seen.push(value);
  });

  await form.submit();

  await tick();

  assert.deepEqual(seen, [true, false]);
});

// type-only: a control that can't hold what the field may write is rejected
// before it can be corrupted at runtime
declare const $number: Control<number>;

declare const $files: Control<FileList>;

declare const $date: Control<Date>;

type Changed = Parameters<
  FormOptions<{
    name?: string;
    when: Date;
    rows: Array<{ tags: string[] }>;
  }>['submit']
>[1];

declare const patch: (changed: Changed) => void;

export const typeChecks = () => {
  // the model's own paths, branches included - not `string`
  patch(['name', 'when', 'rows', 'rows.0', 'rows.1.tags', 'rows.2.tags.3']);

  // @ts-expect-error a `Date` is a value, whatever methods it carries
  patch(['when.getTime']);

  // @ts-expect-error not a path of the model
  patch(['nmae']);

  // an emptied numeric field writes NaN, which is a number - so the model
  // never has to widen
  NativeField({ type: 'numeric', control: $number, render: () => null });

  // @ts-expect-error a text field never writes a number
  NativeField({ type: 'text', control: $number, render: () => null });

  // @ts-expect-error the browser hands back null when nothing is picked
  NativeField({ type: 'file', control: $files, render: () => null });

  // converted, so the control holds what `parse` returns
  NativeField({
    type: 'date',
    control: $date,
    parse: (value) => new Date(value),
    format: (date) => date.toISOString().slice(0, 10),
    render: () => null,
  });

  NativeField({
    type: 'date',
    control: $date,
    // @ts-expect-error the element holds a string, not a date
    parse: (value: Date) => value,
    render: () => null,
  });
};

test('converters sit between the element and the control, both ways', async () => {
  const $values = createControl({ email: '' });

  const form = createForm($values);

  const entry = register(form, $values.email);

  entry._native = getKind('text');

  entry._parse = (value: string) => value.toLowerCase();

  const input = fakeInput(0, 'text');

  setElement(entry, input as unknown as HTMLElement);

  input.value = 'Jane@Example.COM';

  input.selectionStart = input.selectionEnd = 4;

  input.emit('input');

  await tick();

  assert.equal(getValue($values.email), 'jane@example.com');
  // written back lowercased, and the caret held because the length is the same
  assert.equal(input.value, 'jane@example.com');
  assert.equal(input.selectionStart, 4);

  // a write the element didn't cause goes through `format`
  entry._format = (value: string) => value.toUpperCase();

  setValue($values.email, 'other@example.com');

  await tick();

  assert.equal(input.value, 'OTHER@EXAMPLE.COM');
});
