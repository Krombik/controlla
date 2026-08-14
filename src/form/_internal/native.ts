import type { NativeFieldType } from '#form/types';
import type {
  FieldElement,
  FieldEntry,
  NativeKind,
} from '#form/internal/types';
import getValue from '#core/getValue';
import setValue from '#core/setValue';
import watchValue from '#core/watchValue';
import isNotEqual from '#form/internal/isNotEqual';

const writeValue = (element: FieldElement, value: any) => {
  // `NaN` is what an empty numeric field reads back as, and a type without
  // value sanitization would spell it out
  element.value = value != null && value === value ? value : '';
};

const readValue = (element: FieldElement) => element.value;

/**
 * `NaN` is the empty one, which keeps the value a `number` all the way to the
 * submit instead of making every numeric model admit `undefined`. It's a
 * value a validator rejects, not a type the rest of the app has to widen for -
 * and `''` would otherwise read back as `0`.
 *
 * A decimal keypad emits the locale separator, and `-` alone is a state the
 * field passes through while being typed into.
 */
const readNumber = (element: FieldElement) => {
  const value = element.value;

  return value ? +value.replace(',', '.') : NaN;
};

/**
 * The DOM already groups radios by name - a `RadioNodeList` reads and writes
 * the whole group, so one element of it is all the field has to hold. Outside
 * a `<form>` there is no list, and the group is however many radios happen to
 * share this one.
 */
const radioGroup = (element: HTMLInputElement) => {
  const form = element.form;

  const nodes = form && form.elements.namedItem(element.name);

  // a lone radio comes back as the element itself, whose `value` is its own
  return nodes && !('tagName' in nodes) ? nodes : undefined;
};

const textAttrs = (inputMode: string) => ({
  type: 'text',
  inputMode,
  // `type='email'` and friends turn these off implicitly, `type='text'` won't,
  // so iOS would capitalize the first letter of an address
  autoCapitalize: 'none',
  autoCorrect: 'off',
  spellCheck: false,
});

const makeFilter = (filter: RegExp) => (event: InputEvent) => {
  const data = event.data;

  // cancelling mid-composition tears the IME's own editing apart, and what it
  // commits arrives as its own event to judge
  if (data != null && !event.isComposing) {
    const element = event.target as HTMLInputElement;

    const value = element.value;

    // the filter only ever guards a text type, where both are numbers
    const start = element.selectionStart!;

    if (
      !filter.test(
        value.slice(0, start) + data + value.slice(element.selectionEnd!)
      )
    ) {
      event.preventDefault();
    }
  }
};

const makeKind = <E extends FieldElement>(
  read: (element: E) => any,
  write: (element: E, value: any) => void,
  attrs: Record<string, string | boolean | undefined> | undefined,
  filter?: (e: InputEvent) => void
): NativeKind<E> => ({
  _read: read,
  _write: write,
  _attrs: attrs,
  _filter: filter,
});

const stringKind = (type: string) => makeKind(readValue, writeValue, { type });

const simpleKind = makeKind(readValue, writeValue, undefined);

const KINDS: Record<string, NativeKind> = {
  text: stringKind('text'),
  search: stringKind('search'),
  url: stringKind('url'),
  tel: stringKind('tel'),
  password: stringKind('password'),
  color: stringKind('color'),
  hidden: stringKind('hidden'),
  date: stringKind('date'),
  month: stringKind('month'),
  week: stringKind('week'),
  time: stringKind('time'),
  'datetime-local': stringKind('datetime-local'),
  textarea: simpleKind,
  select: simpleKind,
  // `type='email'` has no text cursor to restore a caret in and runs its own
  // validation, which accepts `a@b` anyway - the keyboard is what's worth keeping
  email: makeKind(readValue, writeValue, textAttrs('email')),
  // same for `type='number'`, plus the scroll wheel silently editing it and
  // an unparseable entry being reported as an empty string
  numeric: makeKind(
    readNumber,
    writeValue,
    textAttrs('numeric'),
    makeFilter(/^-?\d*$/)
  ),
  decimal: makeKind(
    readNumber,
    writeValue,
    textAttrs('decimal'),
    makeFilter(/^-?\d*[.,]?\d*$/)
  ),
  range: makeKind(
    (element: HTMLInputElement) => element.valueAsNumber,
    writeValue,
    { type: 'range' }
  ),
  checkbox: makeKind(
    (element: HTMLInputElement) => element.checked,
    (element: HTMLInputElement, value) => {
      element.checked = !!value;
    },
    { type: 'checkbox' }
  ),
  radio: makeKind(
    (element: HTMLInputElement) => {
      const group = radioGroup(element);

      return group ? group.value : element.checked ? element.value : '';
    },
    (element: HTMLInputElement, value) => {
      const group = radioGroup(element);

      if (group) {
        group.value = value;
      } else {
        element.checked = element.value === value;
      }
    },
    { type: 'radio' }
  ),
  // the browser owns this one: it refuses anything but an empty string
  file: makeKind(
    (element: HTMLInputElement) => element.files,
    (element: HTMLInputElement) => {
      element.value = '';
    },
    { type: 'file' }
  ),
  multiselect: makeKind(
    (element: HTMLSelectElement) => {
      const options = element.options;

      const value: string[] = [];

      for (let i = 0, l = options.length; i < l; i++) {
        if (options[i].selected) {
          value.push(options[i].value);
        }
      }

      return value;
    },
    (element: HTMLSelectElement, value) => {
      const options = element.options;

      for (let i = 0, l = options.length; i < l; i++) {
        const option = options[i];

        option.selected = value != null && value.indexOf(option.value) != -1;
      }
    },
    { multiple: true }
  ),
};

export const getKind = (type: NativeFieldType) => KINDS[type];

/**
 * A write landing while the field is being typed in drops the caret to the
 * end - the value setter says so. Holding its distance from the end puts it
 * back for a transform that keeps what was typed in order; a reformatting one
 * moves characters around and has to place the caret itself.
 */
const writeKeepingCaret = (entry: FieldEntry, value: any) => {
  // a select has no `selectionStart`, which is exactly what the guard below
  // reads it for
  const element = entry._element as HTMLInputElement;

  const kind = entry._native!;

  // the element is where this value came from unless something transformed it
  // on the way - and writing what it already holds is what moves the caret
  if (!isNotEqual(kind._read(element), value)) {
    return;
  }

  // null for every type without a text cursor, which is also every type
  // `setSelectionRange` refuses
  const start = element.selectionStart;

  if (start == null) {
    writeElement(entry, element, value);

    return;
  }

  const end = element.selectionEnd;

  const prevValue = element.value;

  writeElement(entry, element, value);

  if (element.value !== prevValue) {
    const shift = element.value.length - prevValue.length;

    element.setSelectionRange(
      start + shift > 0 ? start + shift : 0,
      end! + shift > 0 ? end! + shift : 0
    );
  }
};

/**
 * Marks the element invalid and points it at whatever describes it, without
 * going through React - the element owns the rest of its state the same way,
 * and this keeps a field from rerendering when an error appears.
 *
 * The whole attribute is composed here rather than merged into what's already
 * there: React rewrites an attribute it holds whenever the prop changes, which
 * would drop an id appended behind its back.
 */
function syncAria(this: FieldEntry) {
  const element = this._element;

  if (element) {
    const invalid = this._error !== undefined;

    const describedBy = this._describedBy;

    const errorId = invalid ? this._errorId : undefined;

    const described = errorId
      ? describedBy
        ? describedBy + ' ' + errorId
        : errorId
      : describedBy;

    if (described !== this._described) {
      this._described = described;

      if (described) {
        element.setAttribute('aria-describedby', described);
      } else {
        element.removeAttribute('aria-describedby');
      }
    }

    if (invalid != this._invalid) {
      this._invalid = invalid;

      if (invalid) {
        element.setAttribute('aria-invalid', 'true');
      } else {
        element.removeAttribute('aria-invalid');
      }
    }
  }
}

export const detachElement = (entry: FieldEntry) => {
  if (entry._detachElement) {
    entry._detachElement();

    entry._detachElement = undefined;
  }
};

/** Only `NativeField` sets `_native`, and only it attaches an element it can read. */
export const readElement = (entry: FieldEntry) =>
  entry._parse(entry._native!._read(entry._element as FieldElement));

const writeElement = (entry: FieldEntry, element: FieldElement, value: any) => {
  entry._native!._write(element, entry._format(value));
};

export const setElement = (entry: FieldEntry, element: HTMLElement | null) => {
  const kind = entry._native!;

  if (element) {
    // every radio of a group carries this same ref, and an event only reaches
    // the one it happened on - so each gets listeners, while the field keeps
    // holding the first, which is enough to reach the whole group
    const onInput = () => {
      const value = readElement(entry);

      // `change` follows `input` for everything a person can edit, and autofill
      // is why the pair is listened to at all - so the second of them is
      // normally carrying what the first already delivered
      // a debounced scheduler sees each keystroke and resets its timer, since
      // what it is compared against is the last commit, not the pending write
      if (isNotEqual(value, getValue(entry._control))) {
        setValue(entry._control, value, entry._scheduler);
      }
    };

    element.addEventListener('input', onInput);

    // `input` alone covers every type a person can edit - the spec fires it
    // ahead of `change` for checkboxes, selects and files too. `change` is
    // here for the writes nobody typed: a password manager assigning `value`
    // and announcing only that. The value it reads back is the one `input`
    // already wrote, so the commit finds nothing to notify
    element.addEventListener('change', onInput);

    if (kind._filter) {
      element.addEventListener('beforeinput', kind._filter);
    }

    if (entry._element === undefined) {
      entry._element = element;

      // immediate fills the element with what the control already holds, and
      // for one still loading it waits and fills it when the value lands
      entry._detachElement = watchValue(
        entry._control,
        (value) => {
          writeKeepingCaret(entry, value);
        },
        true
      );

      // a fresh element carries none of what the last one was told
      entry._described = undefined;

      entry._invalid = false;

      entry._syncAria = syncAria;

      entry._syncAria();
    }
  } else if (
    entry._element !== undefined &&
    // React detaches a ref before it removes the node, and says nothing about
    // which node it was: the held one is still ours unless it left the document
    entry._element.isConnected === false
  ) {
    entry._element = undefined;

    detachElement(entry);
  }
};
