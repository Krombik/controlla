import { useRef, version } from 'react';

import type {
  FieldElement,
  FieldEntry,
  FormInternals,
  NativeKind,
} from '#form/internal/types';
import type { NativeFieldOptions, NativeFieldRenderProps } from '#form/types';
import { INTERNALS } from '#internal/constants';
import setValue from '#core/setValue';
import watchValue from '#core/watchValue';
import identity from '#internal/identity';
import isNotEqual from '#internal/isNotEqual';
import { holdEntry, releaseEntry } from '#form/internal/entry';
import { handleBlur } from '#form/internal/validator';

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

    if (
      !filter.test(
        value.slice(0, element.selectionStart!) +
          data +
          value.slice(element.selectionEnd!)
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
    const invalid = !!this._errorCount;

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

/** The element is the value: what it holds is read back on every event. */
const readElement = (entry: FieldEntry, event: Pick<Event, 'target'>) =>
  entry._parse(entry._native!._read(event.target as FieldElement));

/**
 * React 19 refs hand back their own cleanup, so each element is released
 * exactly. Below that a ref only hears that it let go, never of what - one
 * element per field there.
 */
const HAS_REF_CLEANUP = parseInt(version) > 18;
type Cache = {
  _entry: FieldEntry;
  _props: NativeFieldRenderProps<any>;
};

/**
 * The element's own wiring, built once per entry: everything but the control is
 * read once, so the type, the converters and the aria ids are fixed for the
 * field's life.
 */
const useNativeProps = (
  form: FormInternals,
  entry: FieldEntry,
  options: NativeFieldOptions<any, any>
): NativeFieldRenderProps<any> => {
  const ref = useRef<Cache>(null);

  let cache = ref.current;

  // a changed control resolves to a different entry, which is a different field
  if (cache === null || cache._entry !== entry) {
    const kind = (entry._native = KINDS[options.type]);

    entry._parse = options.parse || identity;

    entry._format = options.format || identity;

    entry._errorId = options.errorId;

    entry._describedBy = options.describedBy;

    const path = entry._control[INTERNALS]._path;

    const filter = kind._filter;

    // what the ref bound below React 19, where letting go says nothing about
    // which element it was
    let release: (() => void) | undefined;

    let typed = false;

    const onInput = (event: Event) => {
      typed = true;

      setValue(entry._control, readElement(entry, event));
    };

    // `change` is here for a password manager assigning the value and
    // announcing only that - anything a person did fired `input` first, which
    // committed it
    const onChange = (event: Event) => {
      if (typed) {
        typed = false;
      } else {
        setValue(entry._control, readElement(entry, event));
      }
    };

    ref.current = cache = {
      _entry: entry,
      _props: {
        name: path ? path.join('.') : undefined,
        ref(element: HTMLElement | null) {
          // below React 19 the field binds one element: whichever it is told
          // about last, and released before the next takes its place
          if (release) {
            release();

            release = undefined;
          }

          if (element) {
            element.addEventListener('input', onInput);

            element.addEventListener('change', onChange);

            if (filter) {
              element.addEventListener('beforeinput', filter);
            }

            let unwatch: (() => void) | undefined;

            // a group of radios carries this same ref; the field holds the
            // first, which reaches all of them
            if (entry._element === undefined) {
              entry._element = element;

              // immediate fills the element, waiting for a value still loading
              unwatch = watchValue(
                entry._control,
                (value) => {
                  const input = element as HTMLInputElement;

                  // writing what it already holds is what moves the caret
                  if (isNotEqual(kind._read(input), value)) {
                    const start = input.selectionStart;

                    const end = input.selectionEnd;

                    const prevValue = input.value;

                    kind._write(input, entry._format(value));

                    // the caret drops to the end on a write, so it is put back
                    // at its distance from it - a reformatting transform moves
                    // characters around and has to place it itself. `null` for
                    // every type without a text cursor
                    if (start != null && input.value !== prevValue) {
                      const shift = input.value.length - prevValue.length;

                      input.setSelectionRange(
                        start + shift > 0 ? start + shift : 0,
                        end! + shift > 0 ? end! + shift : 0
                      );
                    }
                  }
                },
                true
              );

              // a fresh element carries none of what the last was told
              entry._described = undefined;

              entry._invalid = false;

              entry._syncAria = syncAria;

              entry._syncAria();
            }

            // the element is the field: it registers with one attached and
            // goes when the last of them is released
            holdEntry(entry);

            const detach = () => {
              element.removeEventListener('input', onInput);

              element.removeEventListener('change', onChange);

              if (filter) {
                element.removeEventListener('beforeinput', filter);
              }

              if (unwatch) {
                unwatch();

                entry._element = undefined;
              }

              releaseEntry(entry);
            };

            if (HAS_REF_CLEANUP) {
              return detach;
            }

            release = detach;
          }
        },
        onBlur: handleBlur(form, entry._control),
        ...kind._attrs,
      },
    };
  }

  return cache._props;
};

export default useNativeProps;
