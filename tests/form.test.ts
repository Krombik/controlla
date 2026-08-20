// the env module must come first: it installs the browser mocks
import { tick } from './_env/dom.ts';
import assert from 'node:assert';
import test from 'node:test';

import createControl from '../src/core/createControl/index.ts';
import createAsyncControl from '../src/core/createAsyncControl/index.ts';
import createAsyncDerivedControl from '../src/core/createAsyncDerivedControl/index.ts';
import getValue from '../src/core/getValue/index.ts';
import setValue from '../src/core/setValue/index.ts';
import invalidate from '../src/core/invalidate/index.ts';
import watchValue from '../src/core/watchValue/index.ts';
import useForm from '../src/form/useForm/index.ts';
import Field from '../src/form/Field/index.ts';
import NativeField from '../src/form/NativeField/index.ts';
import Validator from '../src/form/Validator/index.ts';
import PathValidator from '../src/form/PathValidator/index.ts';
import useValidator from '../src/form/useValidator/index.ts';
import usePathValidator from '../src/form/usePathValidator/index.ts';
import useFieldState from '../src/form/useFieldState/index.ts';
import useField from '../src/form/useField/index.ts';
import useNativeField from '../src/form/useNativeField/index.ts';
import FormContext from '../src/form/_internal/FormContext.ts';
import { renderHook } from './_env/hooks.ts';
import isNotEqual from '../src/form/_internal/isNotEqual.ts';
import noop from '../src/core/_internal/noop.ts';
import { INTERNALS } from '../src/core/_internal/constants.ts';
import type {
  ControlError,
  ControlErrors,
  FieldState,
  FormOptions,
  FormState,
} from '../src/form/types.ts';
import type { Control, ReadonlyControl } from '../src/core/types.ts';

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
    setAttribute() {},
    removeAttribute() {},
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

/** Renders a component of the module with the form in context, and mounts it. */
const mount = <T>(form: FormState | undefined, render: () => T) =>
  // stands in for the `FormProvider` the components read - around every render,
  // since a value change drives its own
  renderHook(render, (run) => {
    (FormContext as any)._currentValue = form;

    try {
      return run();
    } finally {
      (FormContext as any)._currentValue = undefined;
    }
  });

const createForm = (control: any, options: Partial<FormOptions> = {}) =>
  renderHook(() => useForm(control, { submit: noop, ...options } as any))
    .result;

/** A mounted `Field` - registration is the mount, and it ends at the unmount. */
const field = (form: FormState, control: any) =>
  mount(
    form,
    () =>
      Field({
        control,
        render: ((props: any, state: any) => ({ props, state })) as any,
      }) as unknown as {
        props: {
          ref(element: unknown): void;
          onBlur?: () => void;
          isError: boolean;
          value: any;
          onChange(value: any): void;
        };
        state: FieldState;
      }
  );

/** A mounted validator - one control or a tuple of them. */
const validator = (
  form: FormState,
  target: any,
  validate: (value: any) => any,
  validateOn?: any
) => mount(form, () => useValidator(target, validate, validateOn) as any);

/** A mounted validator reporting errors by path under the control. */
const pathValidator = (
  form: FormState,
  control: any,
  validate: (value: any) => any,
  validateOn?: any
) => mount(form, () => usePathValidator(control, validate, validateOn) as any);

/** The field state of a control, from outside any field of it. */
const fieldState = (form: FormState, control: any) =>
  mount(form, () => useFieldState(control));

/** A mounted `NativeField` - `ref` binds an element, `null` lets one go again. */
const nativeField = (form: FormState, props: any) => {
  const rendered = mount(
    form,
    () =>
      NativeField({
        render: ((renderProps: any) => renderProps) as any,
        ...props,
      }) as unknown as {
        ref(element: unknown): (() => void) | void;
        onBlur?: (event: { target: unknown }) => void;
      }
  );

  return {
    ref: rendered.result.ref,
    onBlur: rendered.result.onBlur,
    unmount: rendered.unmount,
    remount: rendered.remount,
  };
};

test('submit runs the handler only when every validator passed', async () => {
  const $values = createControl({ email: '', age: 0 });

  const submitted: Array<{ email: string; age: number }> = [];

  const form = createForm($values, {
    submit(values: any) {
      submitted.push(values);
    },
  });

  field(form, $values.email);

  validator(form, $values.email, (email: string) =>
    email.includes('@') ? undefined : 'invalid'
  );

  field(form, $values.age);

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

  field(form, $values.user.name);

  const { $isDirty } = form;

  assert.equal(getValue($isDirty), false);

  setValue($values.user.name, 'john');

  await tick();

  assert.equal(getValue($isDirty), true);

  // a parent registering later baselines against the same moment, so it sees
  // the edit its own child already made
  const parent = field(form, $values.user).result.state;

  assert.equal(getValue(parent.$isDirty), true);

  form.reset();

  await tick();

  assert.equal(getValue($values.user.name), 'jane');
  assert.equal(getValue($isDirty), false);
});

test('a stale async validation never writes its error', async () => {
  const $values = createControl({ name: '' });

  const form = createForm($values);

  const resolvers: Array<(error: string | undefined) => void> = [];

  const $error = validator(
    form,
    $values.name,
    () => new Promise<string | undefined>((resolve) => resolvers.push(resolve))
  ).result;

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

  assert.equal(getValue($error), 'taken');

  await tick();

  assert.equal(getValue($isValidating), false);
});

test('an uncontrolled field lets the element own the value both ways', async () => {
  const $values = createControl({ name: 'jane' });

  const form = createForm($values);

  const input = fakeInput();

  const { ref } = nativeField(form, { type: 'text', control: $values.name });

  const detach = ref(input)!;

  assert.equal(input.value, 'jane');

  const writes: string[] = [];

  const unwatch = watchValue($values.name, (value) => {
    writes.push(value);
  });

  input.value = 'john';

  input.emit('input');

  // `change` follows what a person types, carrying what `input` already gave
  input.emit('change');

  await tick();

  assert.equal(getValue($values.name), 'john');
  assert.deepEqual(writes, ['john']);

  // a password manager assigns the value and announces only `change`
  input.value = 'jack';

  input.emit('change');

  await tick();

  assert.deepEqual(writes, ['john', 'jack']);

  unwatch();

  setValue($values.name, 'jill');

  await tick();

  assert.equal(input.value, 'jill');

  detach();

  setValue($values.name, 'jane');

  await tick();

  assert.equal(input.value, 'jill');
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
  const later = field(form, $values.second);

  const earlier = field(form, $values.first);

  validator(form, $values.second, invalid);

  validator(form, $values.first, invalid);

  const laterInput = fakeInput(5);

  const earlierInput = fakeInput(1);

  // a controlled `Field` only records the element, it binds nothing
  later.result.props.ref(laterInput);

  earlier.result.props.ref(earlierInput);

  await form.submit();

  assert.equal(earlierInput.focused, true);
  assert.equal(laterInput.focused, false);
});

test('focus answers whether the field had an element to focus', () => {
  const $values = createControl({ email: '', name: '', hidden: '' });

  const form = createForm($values);

  const email = field(form, $values.email);

  field(form, $values.name);

  const input = fakeInput();

  email.result.props.ref(input);

  assert.equal(form.focus($values.email), true);
  assert.equal(input.focused, true);

  // registered, but its `ref` never reached an element
  assert.equal(form.focus($values.name), false);
  // no field on it at all
  assert.equal(form.focus($values.hidden), false);
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

test('the element type picks how a value is written back', async () => {
  const $values = createControl({ agreed: false, tags: ['a'] });

  const form = createForm($values);

  const box = fakeInput(0, 'checkbox');

  nativeField(form, { type: 'checkbox', control: $values.agreed }).ref(box);

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

  nativeField(form, { type: 'multiselect', control: $values.tags }).ref(select);

  assert.deepEqual(
    select.options.map((it: any) => it.selected),
    [true, false]
  );
});

test('a rewrite while typing keeps the caret off the end', async () => {
  const $values = createControl({ name: 'abcdef', age: '' });

  const form = createForm($values);

  const input = fakeInput();

  nativeField(form, { type: 'text', control: $values.name }).ref(input);

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

  nativeField(form, { type: 'text', control: $values.age }).ref(number);

  setValue($values.age, '5');

  await tick();

  assert.equal(number.selectionStart, null);
});

test('a numeric field parses what it reads and refuses what it cannot', async () => {
  const $values = createControl({ amount: NaN });

  const form = createForm($values);

  const input = fakeInput(0, 'text');

  nativeField(form, { type: 'decimal', control: $values.amount }).ref(input);

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

  const { ref } = nativeField(form, { type: 'radio', control: $values.plan });

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

  const detachFirst = ref(first)!;

  const detachSecond = ref(second)!;

  group.value = 'pro';

  second.emit('change');

  await tick();

  assert.equal(getValue($values.plan), 'pro');

  setValue($values.plan, 'free');

  await tick();

  assert.equal(group.value, 'free');

  // releasing the element the field holds is what stops the writing - the
  // others go on reading the element they sit on, which a read through the
  // field's own element could not have survived
  detachFirst();

  group.value = 'pro';

  second.emit('change');

  await tick();

  assert.equal(getValue($values.plan), 'pro');

  group.value = 'kept';

  setValue($values.plan, 'free');

  await tick();

  assert.equal(group.value, 'kept');

  // and the one that was released reports nothing
  detachSecond();

  group.value = 'basic';

  second.emit('change');

  await tick();

  assert.equal(getValue($values.plan), 'free');
});

test('reset reaches a path no field is mounted on, and takes a value', async () => {
  const $values = createControl({
    user: { name: 'jane', age: 30 },
    hidden: 'kept',
  });

  const form = createForm($values);

  // only one field ever registers; the rest is covered by the form control
  field(form, $values.user.name);

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

  field(form, $values.note);

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

test('a submit leaves the baseline where it is', async () => {
  const $values = createControl({ name: 'jane' });

  const form = createForm($values);

  field(form, $values.name);

  const { $isDirty } = form;

  setValue($values.name, 'john');

  await tick();

  await form.submit();

  await tick();

  // what was sent is a baseline only if the handler makes it one
  assert.equal(getValue($isDirty), true);

  form.reset($values, { name: 'john' });

  await tick();

  assert.equal(getValue($isDirty), false);

  form.reset();

  await tick();

  assert.equal(getValue($values.name), 'john');
});

test('a field is dirty against the baseline, not against its own last value', async () => {
  const $values = createControl({ name: 'jane', note: '' });

  const form = createForm($values);

  const name = field(form, $values.name).result.state;

  const note = field(form, $values.note).result.state;

  assert.equal(getValue(name.$isDirty), false);

  setValue($values.name, 'john');

  await tick();

  assert.equal(getValue(name.$isDirty), true);
  assert.equal(getValue(note.$isDirty), false);

  // the value doesn't move here, only what it is compared against
  form.reset($values, getValue($values)!);

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
    submit(values: any, paths: string[]) {
      changed.push(paths);

      // the handler is what moves the baseline
      form.reset($data.settings, values);
    },
  });

  field(form, $data.settings.alerts);

  field(form, $data.settings.digest);

  field(form, $foreign.note);

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

  // the first submit's handler rebaselined, so `alerts` is no longer something
  // that moved
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

  field(form, $values.name);

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

test('the first value a load brings is the baseline, the ones after it are not', async () => {
  const $values = createAsyncControl<{ name: string }>();

  const changed: string[][] = [];

  const form = createForm($values, {
    submit(_values: any, paths: string[]) {
      changed.push(paths);
    },
  });

  field(form, $values.name);

  setValue($values, { name: 'jane' });

  await tick();

  assert.equal(
    getValue(form.$isDirty),
    false,
    'waiting for the data is not an edit'
  );

  await form.submit();

  assert.deepEqual(changed, [[]], 'nothing changed against what arrived');

  setValue($values.name, 'john');

  await tick();

  assert.equal(getValue(form.$isDirty), true);

  // the watch was for one value - nothing is left listening for the next
  assert.equal(
    (form as any)._armedRoots.size,
    0,
    'the first value is all the form waited for'
  );

  // a reload is not the form's business - resetting to what it brought is for
  // whoever asked for it
  invalidate($values, true);

  setValue($values, { name: 'joan' });

  await tick();

  assert.equal(getValue($values.name), 'joan');
  assert.equal(
    getValue(form.$isDirty),
    true,
    'a silent reload does not move the baseline'
  );

  invalidate($values);

  await tick();

  setValue($values, { name: 'jean' });

  await tick();

  assert.equal(
    getValue(form.$isDirty),
    true,
    'a loud one neither, value cleared and all'
  );

  form.reset($values, getValue($values)!);

  await tick();

  assert.equal(
    getValue(form.$isDirty),
    false,
    'a reset to what it brought is what does'
  );
});

test('a form over an async derived control baselines its first value too', async () => {
  const $server = createAsyncControl<{ name: string; extra: number }>();

  const $values = createAsyncDerivedControl($server, (info) => ({
    name: info.name,
  }));

  const form = createForm($values, { submit: noop });

  field(form, ($values as any).name);

  setValue($server, { name: 'jane', extra: 1 });

  await tick();

  assert.equal(
    getValue(form.$isDirty),
    false,
    'the first recompute is the baseline'
  );

  setValue(($values as any).name, 'john');

  await tick();

  assert.equal(getValue(form.$isDirty), true);

  // a recompute off its sources never loads, and would not move the baseline
  // even if it did
  invalidate($server, true);

  setValue($server, { name: 'JOHN', extra: 2 });

  await tick();

  assert.equal(getValue(($values as any).name), 'JOHN');
  assert.equal(
    getValue(form.$isDirty),
    true,
    'what its source reloaded is a value like any other'
  );
});

test('a value that landed with nobody listening is still the baseline', async () => {
  const $values = createAsyncControl<{ name: string }>();

  const rendered = renderHook(() => useForm($values, { submit: noop } as any));

  const form = rendered.result;

  field(form, $values.name);

  // the mount is what subscribes the load watch, so unmounted it is not there
  // for the value - and the next notify is an edit
  rendered.unmount();

  setValue($values, { name: 'jane' });

  await tick();

  rendered.remount();

  assert.equal(
    (form as any)._armedRoots.size,
    0,
    'the value it was waiting for is already there'
  );
  assert.equal(getValue(form.$isDirty), false);

  setValue($values.name, 'john');

  await tick();

  assert.equal(getValue(form.$isDirty), true);

  form.reset($values.name);

  await tick();

  assert.equal(getValue($values.name), 'jane', 'what arrived, not the edit');

  // the watch it was subscribed with is gone with the value it waited for
  invalidate($values, true);

  setValue($values, { name: 'joan' });

  await tick();

  assert.equal(
    getValue(form.$isDirty),
    true,
    'a reload after it is not a rebaseline'
  );
});

test('the paths are not collected for a submit that never asked', async () => {
  const $data = createControl({ alerts: false });

  let passed: any;

  const form = createForm($data, {
    submit(_values: any) {
      passed = arguments[1];
    },
  });

  field(form, $data.alerts);

  setValue($data.alerts, true);

  await tick();

  await form.submit();

  assert.deepEqual(passed, []);
});

test('submitFailed runs instead of submit, and a reset clears what stopped it', async () => {
  const $values = createControl({ email: '', name: '' });

  let failures = 0;

  const form = createForm($values, {
    submit() {
      throw new Error('submitted an invalid form');
    },
    submitFailed() {
      failures++;
    },
  });

  field(form, $values.email);

  const $error = validator(form, $values.email, () => 'invalid email').result;

  await form.submit();

  assert.equal(failures, 1);
  assert.equal(getValue($error), 'invalid email');

  form.reset();

  await tick();

  assert.equal(getValue($error), undefined);
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

  let error: string | undefined = 'invalid';

  nativeField(form, {
    type: 'text',
    control: $values.email,
    errorId: 'email-error',
    describedBy: 'hint',
  }).ref(input);

  validator(form, $values.email, () => error);

  assert.equal(attributes['aria-invalid'], undefined);
  assert.equal(attributes['aria-describedby'], 'hint');

  await form.validate();

  assert.equal(attributes['aria-invalid'], 'true');
  // the field composes what describes it with the error it now holds
  assert.equal(attributes['aria-describedby'], 'hint email-error');

  // a validator dropped without passing leaves the error alone, so it has to
  // actually pass for the attributes to come back off
  error = undefined;

  await form.validate();

  assert.equal(attributes['aria-invalid'], undefined);
  assert.equal(attributes['aria-describedby'], 'hint');
});

test('isSubmitting flips even when nothing about the submit is async', async () => {
  const $values = createControl({ name: 'jane' });

  const form = createForm($values, {
    submit() {},
  });

  field(form, $values.name);

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

  const $rules = createControl({
    email: '',
    dates: { from: 1, to: 2 },
    rows: [''],
    agreed: false,
  });

  const $error: ReadonlyControl<string | undefined> = useValidator(
    $rules.email,
    (email) => (email ? undefined : 'required')
  );

  $error;

  // @ts-expect-error the value is what a rule is handed
  useValidator($rules.email, (email: number) => (email ? undefined : 'x'));

  const [, $toError] = useValidator(
    [$rules.dates.from, $rules.dates.to],
    ([from, to]) =>
      from <= to ? undefined : [undefined, 'ends before it starts']
  );

  const toError: ReadonlyControl<string | undefined> = $toError;

  toError;

  // @ts-expect-error a tuple answers with a slot per control
  useValidator([$rules.dates.from], () => 'not a slot');

  const errorOf = usePathValidator($rules.rows, (rows) => {
    const errors: ControlErrors<string> = [];

    for (let i = 0; i < rows.length; i++) {
      errors.push([$rules.rows[i], 'nope']);
    }

    return errors;
  });

  const row: ReadonlyControl<string | undefined> = errorOf($rules.rows[0]);

  row;

  // a pair of its own shape per control, and each read keeps its own error
  const mixed = usePathValidator($rules, ({ email, dates }) => [
    ...(email
      ? []
      : [
          [$rules.email, 'required'] as ControlError<
            typeof $rules.email,
            string
          >,
        ]),
    ...(dates.from <= dates.to
      ? []
      : [
          [$rules.dates.to, { code: 7 }] as ControlError<
            typeof $rules.dates.to,
            { code: number }
          >,
        ]),
  ]);

  const emailError: ReadonlyControl<string | undefined> = mixed($rules.email);

  emailError;

  const codeError: ReadonlyControl<{ code: number } | undefined> = mixed(
    $rules.dates.to
  );

  codeError;

  // @ts-expect-error nothing was ever paired with a control of booleans
  mixed($rules.agreed);

  const props = useField($rules.email);

  const value: string = props.value;

  value;

  props.onChange('other');

  // @ts-expect-error the field holds a string
  props.onChange(1);

  useNativeField($rules.agreed, { type: 'checkbox' }).name;

  // @ts-expect-error a checkbox writes a boolean, this control holds a string
  useNativeField($rules.email, { type: 'checkbox' });

  useFieldState($rules.email).$isError;
};

test('converters sit between the element and the control, both ways', async () => {
  const $values = createControl({ email: '' });

  const form = createForm($values);

  const input = fakeInput(0, 'text');

  let shout = false;

  nativeField(form, {
    type: 'text',
    control: $values.email,
    parse: (value: string) => value.toLowerCase(),
    format: (value: string) => (shout ? value.toUpperCase() : value),
  }).ref(input);

  input.value = 'Jane@Example.COM';

  input.selectionStart = input.selectionEnd = 4;

  input.emit('input');

  await tick();

  assert.equal(getValue($values.email), 'jane@example.com');
  // written back lowercased, and the caret held because the length is the same
  assert.equal(input.value, 'jane@example.com');
  assert.equal(input.selectionStart, 4);

  // a write the element didn't cause goes through `format`
  shout = true;

  setValue($values.email, 'other@example.com');

  await tick();

  assert.equal(input.value, 'OTHER@EXAMPLE.COM');
});

test('a validation still in flight when its validator goes counts against nothing', async () => {
  const $values = createControl({ email: '' });

  const form = createForm($values);

  let settle!: (error: any) => void;

  const email = validator(
    form,
    $values.email,
    () =>
      new Promise((resolve) => {
        settle = resolve;
      })
  );

  const validating = form.validate();

  email.unmount();

  settle('invalid');

  await validating;

  // nothing is left to clear it, so an error written here would block the form
  // for good
  assert.equal(getValue(form.$isValid), true);
  assert.equal(await form.validate(), true);
});

test('a field over the form control leaves the form its own entry', async () => {
  const $values = createControl({ email: '' });

  const form = createForm($values);

  field(form, $values).unmount();

  setValue($values.email, 'jane@example.com');

  await tick();

  // the whole-subtree entry is what sees a path nothing is mounted on
  assert.equal(getValue(form.$isDirty), true);
});

test('an element bound to another control stops feeding the old one', async () => {
  const $values = createControl({ a: '', b: '' });

  const form = createForm($values);

  const input = fakeInput(0, 'text');

  const a = nativeField(form, { type: 'text', control: $values.a });

  const detachA = a.ref(input)!;

  await tick();

  // a swapped `control` resolves to its own entry, over the element the old one
  // was bound to - React releases that ref before it attaches the new one
  detachA();

  nativeField(form, { type: 'text', control: $values.b }).ref(input);

  input.value = 'typed';

  input.emit('input');

  await tick();

  assert.equal(getValue($values.a), '');
  assert.equal(getValue($values.b), 'typed');
});

test('a field hidden by Activity is marked again when it comes back', async () => {
  const $values = createControl({ email: '' });

  const form = createForm($values);

  const email = field(form, $values.email);

  const { $isError } = email.result.state;

  validator(form, $values.email, (address: string) =>
    address.includes('@') ? undefined : 'invalid'
  );

  await form.validate();

  assert.equal(getValue($isError), true);

  // hidden: the effects are unmounted, the state and the DOM are kept
  email.unmount();

  await tick();

  assert.equal(getValue($isError), false, 'nothing is left to mark');

  email.remount();

  await tick();

  // the validator still holds it, so coming back is enough
  assert.equal(getValue($isError), true);
});

test('a blur runs the validators that validate on blur, and only those', async () => {
  const $values = createControl({ email: '', name: '' });

  const form = createForm($values);

  const input = fakeInput(0, 'text');

  const seen: string[] = [];

  const { ref, onBlur } = nativeField(form, {
    type: 'text',
    control: $values.email,
  });

  validator(
    form,
    $values.email,
    (email: string) => {
      seen.push(email);
    },
    'blur'
  );

  // a rule of another field, and a rule of this one that waits for the submit
  validator(form, $values.name, () => seen.push('name'), 'blur');

  validator(form, $values.email, () => seen.push('submit'));

  ref(input);

  input.value = 'jane@example.com';

  input.emit('input');

  await tick();

  // the element wrote it as it was typed, so this is what the rule reads
  assert.equal(getValue($values.email), 'jane@example.com');

  onBlur!({ target: input });

  assert.deepEqual(seen, ['jane@example.com']);
});

test('a native field is registered by its element, and goes with the last', async () => {
  const $values = createControl({ email: '' });

  const form = createForm($values);

  const first = fakeInput(0, 'text');

  const second = fakeInput(1, 'text');

  const { ref } = nativeField(form, { type: 'text', control: $values.email });

  const registered = () => (form as any)._entries.has($values.email);

  const detachFirst = ref(first)!;

  const detachSecond = ref(second)!;

  assert.equal(registered(), true);

  detachFirst();

  assert.equal(registered(), true, 'one element still holds it');

  detachSecond();

  assert.equal(registered(), false);
});

test('a reset before the data lands leaves the control alone', async () => {
  const $values = createAsyncControl<{ name: string }>();

  const form = createForm($values);

  field(form, $values.name);

  // there is no baseline to restore to yet, and an async control refuses to be
  // written back to nothing
  form.reset();

  await tick();

  setValue($values, { name: 'jane' });

  await tick();

  assert.deepEqual(getValue($values), { name: 'jane' });
  assert.equal(getValue(form.$isDirty), false);
});

test('a tuple validator answers per control', async () => {
  const $values = createControl({ password: 'a', repeat: 'b' });

  const form = createForm($values);

  const password = field(form, $values.password).result.state;

  const repeat = field(form, $values.repeat).result.state;

  const [$passwordError, $repeatError] = validator(
    form,
    [$values.password, $values.repeat],
    ([first, second]: string[]) =>
      first === second ? undefined : [undefined, 'passwords differ']
  ).result;

  assert.equal(await form.validate(), false);

  assert.equal(getValue($passwordError), undefined);
  assert.equal(getValue($repeatError), 'passwords differ');
  assert.equal(getValue(password.$isError), false);
  assert.equal(getValue(repeat.$isError), true);

  setValue($values.repeat, 'a');

  await tick();

  // an error revalidates live until it clears, whatever the trigger was
  assert.equal(getValue($repeatError), undefined);
  assert.equal(getValue(repeat.$isError), false);
  assert.equal(getValue(form.$isValid), true);
});

test('an error lands on the control it names, and on nothing else', async () => {
  const $values = createControl({ address: { street: '', city: 'york' } });

  const form = createForm($values);

  const address = field(form, $values.address).result.state;

  const street = field(form, $values.address.street).result.state;

  const city = field(form, $values.address.city).result.state;

  let errors: ControlErrors<string> = [[$values.address.street, 'required']];

  const errorOf = pathValidator(form, $values, () => errors).result;

  assert.equal(await form.validate(), false);

  assert.equal(getValue(errorOf($values.address.street)), 'required');
  assert.equal(getValue(errorOf($values.address.city)), undefined);

  assert.equal(getValue(street.$isError), true);
  assert.equal(getValue(city.$isError), false);
  // the branch above the one that failed is not what failed
  assert.equal(getValue(address.$isError), false);

  errors = [];

  // no entries is no answer at all
  assert.equal(await form.validate(), true);
  assert.equal(getValue(errorOf($values.address.street)), undefined);
  assert.equal(getValue(street.$isError), false);
});

test('two validators over one control, and isError is either of them', async () => {
  const $values = createControl({ email: 'jane' });

  const form = createForm($values);

  const { $isError } = fieldState(form, $values.email).result;

  const first = validator(form, $values.email, () => 'invalid');

  validator(form, $values.email, () => undefined);

  assert.equal(await form.validate(), false);
  assert.equal(getValue($isError), true);

  first.unmount();

  await tick();

  // the one that held it is gone; the other never did
  assert.equal(getValue($isError), false);
  assert.equal(getValue(form.$isValid), true);
});

test('an error written into the control marks the field like any other', async () => {
  const $values = createControl({ email: 'jane@example.com' });

  const form = createForm($values);

  const email = field(form, $values.email).result.state;

  const $error = validator(form, $values.email, () => undefined).result;

  assert.equal(await form.validate(), true);

  // what a rejection coming back from the server does
  setValue($error, 'already taken');

  await tick();

  assert.equal(getValue(email.$isError), true);
  assert.equal(getValue(form.$isValid), false);

  setValue($values.email, 'other@example.com');

  await tick();

  // it revalidates like its own error, and this one passes
  assert.equal(getValue(email.$isError), false);
});

test('a validator on change needs no submit', async () => {
  const $values = createControl({ email: 'jane@example.com' });

  const form = createForm($values);

  const changing = validator(
    form,
    $values.email,
    (email: string) => (email.includes('@') ? undefined : 'invalid'),
    'change'
  );

  const $error = changing.result;

  // nothing ran yet: a field that never validated counts as valid
  assert.equal(getValue($error), undefined);

  setValue($values.email, 'jane');

  await tick();

  assert.equal(getValue($error), 'invalid');

  changing.unmount();

  await tick();

  // unmounted, so it has let its controls go along with its error
  assert.equal(getValue($error), undefined);

  setValue($values.email, 'nobody');

  await tick();

  assert.equal(getValue($error), undefined);
});

test('a failed submit focuses under an error holding no element of its own', async () => {
  const $values = createControl({ rows: ['a', 'b'] });

  const form = createForm($values, {
    submit() {
      throw new Error('submitted an invalid form');
    },
  });

  const first = field(form, $values.rows[0]);

  const second = field(form, $values.rows[1]);

  const firstInput = fakeInput(1);

  const secondInput = fakeInput(5);

  first.result.props.ref(firstInput);

  second.result.props.ref(secondInput);

  validator(form, $values.rows, () => 'too many');

  await form.submit();

  // the array holds the error and no element, so the first field under it does
  assert.equal(firstInput.focused, true);
  assert.equal(secondInput.focused, false);
});

test('a validator of an unregistered path still blocks the submit', async () => {
  const $values = createControl({ email: '', hidden: '' });

  const form = createForm($values);

  field(form, $values.email);

  validator(form, $values.hidden, () => 'required');

  assert.equal(await form.validate(), false);
  assert.equal(getValue(form.$isValid), false);
});

test('the validator components mount the same rules the hooks do', async () => {
  const $values = createControl({ email: '', dates: { from: 2, to: 1 } });

  const form = createForm($values);

  const errors: any[] = [];

  mount(
    form,
    () =>
      Validator({
        control: $values.email,
        validate: () => 'required',
        render: ($error: any) => {
          errors.push($error);

          return null;
        },
      }) as any
  );

  const paths = mount(
    form,
    () =>
      PathValidator({
        control: $values.dates,
        validate: ({ from, to }: any) =>
          from <= to
            ? undefined
            : [[$values.dates.to, 'ends before it starts']],
      } as any) as any
  );

  assert.equal(await form.validate(), false);

  assert.equal(getValue(errors[0]), 'required');
  // no `render` is nothing rendered
  assert.equal(paths.result, null);

  // the field state of a path nothing is mounted on picks the error up
  const { $isError } = fieldState(form, $values.dates.to).result;

  assert.equal(getValue($isError), true);
  assert.equal(
    getValue(fieldState(form, $values.dates.from).result.$isError),
    false
  );
});

test('a rule can watch a control it does not answer for', async () => {
  const $values = createControl({ email: 'jane@example.com' });

  // where a rejection coming back from the server is kept, and cleared from
  const $rejected = createControl<string | undefined>(undefined);

  const form = createForm($values);

  const email = field(form, $values.email).result.state;

  const [$emailError] = validator(
    form,
    [$values.email, $rejected],
    ([address, rejected]: [string, string | undefined]) => [
      rejected ?? (address.includes('@') ? undefined : 'invalid email'),
    ],
    'change'
  ).result;

  setValue($rejected, 'already taken');

  await tick();

  // the store moved, so the rule ran again
  assert.equal(getValue($emailError), 'already taken');
  assert.equal(getValue(email.$isError), true);
  assert.equal(getValue(form.$isValid), false);

  // the slot it never answered for is nobody's error
  assert.equal(getValue(fieldState(form, $rejected).result.$isError), false);

  setValue($rejected, undefined);

  await tick();

  assert.equal(getValue($emailError), undefined);
  assert.equal(getValue(email.$isError), false);
  assert.equal(getValue(form.$isValid), true);
});

test('a reset a rule only partly covers runs it again on what was restored', async () => {
  const $values = createControl({ email: 'jane@example.com', name: 'jane' });

  const form = createForm($values);

  const email = field(form, $values.email).result.state;

  // wider than what gets reset below, so its error is its own to keep
  const errorOf = pathValidator(form, $values, ({ email: address }: any) =>
    address.includes('@') ? [] : [[$values.email, 'invalid email']]
  ).result;

  setValue($values.email, 'nobody');

  await tick();

  assert.equal(await form.validate(), false);
  assert.equal(getValue(errorOf($values.email)), 'invalid email');

  form.reset($values.email);

  await tick();

  // the restored value is what re-ran it, so what it reports is about that
  assert.equal(getValue($values.email), 'jane@example.com');
  assert.equal(getValue(errorOf($values.email)), undefined);
  assert.equal(getValue(email.$isError), false);
  assert.equal(getValue(form.$isValid), true);
});

test('a field is validating while a rule covering it is in flight', async () => {
  const $values = createControl({ email: '', name: '' });

  const form = createForm($values);

  const email = field(form, $values.email).result.state;

  const name = field(form, $values.name).result.state;

  let settle!: (error: string | undefined) => void;

  validator(
    form,
    $values.email,
    () =>
      new Promise<string | undefined>((resolve) => {
        settle = resolve;
      })
  );

  const validating = form.validate();

  await tick();

  assert.equal(getValue(email.$isValidating), true);
  assert.equal(getValue(name.$isValidating), false, 'no rule of its own');
  assert.equal(getValue(form.$isValidating), true);

  // a field arriving mid-flight is validating too
  const late = fieldState(form, $values.email).result;

  assert.equal(getValue(late.$isValidating), true);

  settle(undefined);

  await validating;

  await tick();

  assert.equal(getValue(email.$isValidating), false);
  assert.equal(getValue(form.$isValidating), false);
});

test('a field hands out the value, writes it back, and reports its error', async () => {
  const $values = createControl({ email: 'jane@example.com' });

  const form = createForm($values);

  const email = field(form, $values.email);

  assert.equal(email.result.props.value, 'jane@example.com');
  assert.equal(email.result.props.isError, false);

  email.result.props.onChange('nobody');

  await tick();

  assert.equal(getValue($values.email), 'nobody');
  // reading the value is what rerenders it, so the next render carries it
  assert.equal(email.render().props.value, 'nobody');

  validator(form, $values.email, (address: string) =>
    address.includes('@') ? undefined : 'invalid email'
  );

  await form.validate();

  await tick();

  assert.equal(email.render().props.isError, true);
});

test('a changed control is a different rule, and takes its error with it', async () => {
  const $values = createControl({ rows: ['', 'b'] });

  const form = createForm($values);

  let index = 0;

  const rule = mount(form, () =>
    useValidator($values.rows[index], (value: string) =>
      value ? undefined : 'required'
    )
  );

  assert.equal(await form.validate(), false);
  assert.equal(getValue(rule.result), 'required');

  const first = rule.result;

  index = 1;

  const second = rule.render();

  await tick();

  // the rule of the old control is gone, and so is what it held
  assert.notEqual(second, first);
  assert.equal(getValue(first), undefined);
  assert.equal(getValue(form.$isValid), true);

  assert.equal(await form.validate(), true, 'the row it moved to passes');
});

test('a bare reset clears the rules of the fields outside the form control', async () => {
  const $values = createControl({ email: 'jane@example.com' });

  const $foreign = createControl({ note: 'kept' });

  const form = createForm($values);

  const note = field(form, $foreign.note).result.state;

  const $error = validator(form, $foreign.note, (value: string) =>
    value === 'kept' ? undefined : 'not what it was'
  ).result;

  setValue($foreign.note, 'edited');

  await tick();

  assert.equal(await form.validate(), false);
  assert.equal(getValue($error), 'not what it was');

  form.reset();

  await tick();

  assert.equal(getValue($foreign.note), 'kept');
  assert.equal(getValue($error), undefined);
  assert.equal(getValue(note.$isError), false);
  assert.equal(getValue(form.$isValid), true);
});

test('a rule may report a control outside what it validates', async () => {
  const $values = createControl({ from: 5, to: 1 });

  const $summary = createControl({ dates: '' });

  const form = createForm($values);

  const summary = field(form, $summary.dates).result.state;

  const errorOf = pathValidator(form, $values, ({ from, to }: any) =>
    from <= to ? [] : [[$summary.dates, 'the range is backwards']]
  ).result;

  assert.equal(await form.validate(), false);

  // marked, and reachable, though it sits in another tree entirely
  assert.equal(getValue(errorOf($summary.dates)), 'the range is backwards');
  assert.equal(getValue(summary.$isError), true);

  // and a field of it arriving afterwards is marked the same way
  const $other = createControl({ note: '' });

  const late = pathValidator(form, $values, () => [
    [$other.note, 'reported before anything was mounted on it'],
  ]);

  assert.equal(await form.validate(), false);

  assert.equal(getValue(fieldState(form, $other.note).result.$isError), true);

  late.unmount();
});

test('two runs of one rule are two answers, and one of them is not both', async () => {
  const $values = createControl({ email: '' });

  const form = createForm($values);

  const resolvers: Array<(error: string | undefined) => void> = [];

  validator(
    form,
    $values.email,
    () => new Promise<string | undefined>((resolve) => resolvers.push(resolve))
  );

  const first = form.validate();

  const second = form.validate();

  await tick();

  assert.equal(getValue(form.$isValidating), true);

  resolvers[0](undefined);

  await first;

  await tick();

  // the second is still out there
  assert.equal(getValue(form.$isValidating), true);

  resolvers[1](undefined);

  await second;

  await tick();

  assert.equal(getValue(form.$isValidating), false);
});

test('an unmounted form lets go of the control it was over', async () => {
  const $values = createControl({ name: 'jane' });

  const rendered = renderHook(() => useForm($values, { submit: noop } as any));

  const form = rendered.result;

  // starts dirty tracking, which is what subscribes the entries
  const { $isDirty } = form;

  setValue($values.name, 'john');

  await tick();

  assert.equal(getValue($isDirty), true);

  const listeners = () => ($values[INTERNALS] as any)._root._listeners.length;

  assert.equal(listeners() > 0, true);

  rendered.unmount();

  // the entry of its own control is the form's to release, no field holds it
  assert.equal(listeners(), 0);
  assert.equal((form as any)._entries.size, 0);

  setValue($values.name, 'jack');

  await tick();

  assert.equal((form as any)._dirtyCount, 0, 'nothing of it is still watching');
});

test('a field lets go of its own element, not of another field of the control', () => {
  const $values = createControl({ email: '' });

  const form = createForm($values);

  const first = field(form, $values.email);

  const second = field(form, $values.email);

  const firstInput = fakeInput(0);

  const secondInput = fakeInput(1);

  first.result.props.ref(firstInput);

  second.result.props.ref(secondInput);

  // whichever bound last is what focus reaches
  assert.equal(form.focus($values.email), true);
  assert.equal(secondInput.focused, true);

  // the other one going takes nothing with it
  first.result.props.ref(null);

  assert.equal(form.focus($values.email), true);

  second.result.props.ref(null);

  assert.equal(form.focus($values.email), false);
});

test('a field of a changed control registers as the field it became', async () => {
  const $values = createControl({ rows: ['a', 'b'] });

  const form = createForm($values);

  let index = 0;

  const row = mount(
    form,
    () =>
      Field({
        control: $values.rows[index],
        render: ((props: any) => props) as any,
      }) as unknown as { value: string }
  );

  const registered = (control: any) => (form as any)._entries.has(control);

  assert.equal(row.result.value, 'a');
  assert.equal(registered($values.rows[0]), true);

  index = 1;

  assert.equal(row.render().value, 'b');

  assert.equal(registered($values.rows[1]), true);
  assert.equal(registered($values.rows[0]), false, 'the one it left is gone');
});

test('the form is where a rule with no trigger of its own gets one', async () => {
  const $values = createControl({ email: 'jane@example.com' });

  const form = createForm($values, { validateOn: 'change' });

  const $error = validator(form, $values.email, (email: string) =>
    email.includes('@') ? undefined : 'invalid'
  ).result;

  setValue($values.email, 'nobody');

  await tick();

  // no mode of its own, so it took the form's
  assert.equal(getValue($error), 'invalid');
});

test('a submit handler that throws is the handler`s to answer for', async () => {
  const $values = createControl({ email: 'jane@example.com' });

  const form = createForm($values, {
    submit() {
      throw new Error('the server said no');
    },
  });

  field(form, $values.email);

  await assert.rejects(form.submit(), /the server said no/);

  // whatever it threw, the form is not left submitting
  assert.equal(getValue(form.$isSubmitting), false);
  assert.equal(getValue(form.$isValid), true);

  // and it submits again when asked again
  await assert.rejects(form.submit(), /the server said no/);
});
