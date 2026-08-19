import type { Control } from '#types';
import type { FieldEntry, FormInternals } from '#form/internal/types';
import type { FormOptions } from '#form/types';
import { EMPTY_ARR, INTERNALS } from '#internal/constants';
import createPrimitiveControl from '#core/createPrimitiveControl';
import getValue from '#core/getValue';
import setValue from '#core/setValue';
import {
  getBaseline,
  getEntry,
  isUnder,
  setEntryDirty,
  snapshotOf,
  startDirtyTracking,
} from '#form/internal/entry';
import { clearUnder, validateAll } from '#form/internal/validator';
import isNotEqual from '#form/internal/isNotEqual';

/** Rewrites one path of a baseline, leaving the rest of it shared. */
const setIn = (
  value: any,
  path: readonly string[],
  index: number,
  next: any
): any => {
  if (index === path.length) {
    return next;
  }

  const key = path[index];

  const copy = Array.isArray(value) ? value.slice() : { ...value };

  copy[key] = setIn(
    value != null ? value[key] : undefined,
    path,
    index + 1,
    next
  );

  return copy;
};

const setSubmitting = (form: FormInternals, isSubmitting: boolean) => {
  form._isSubmitting = isSubmitting;

  if (form._submittingControl) {
    setValue(form._submittingControl, isSubmitting);
  }
};

/** Restores the {@link target} to whatever it currently restores to. */
const restore = (form: FormInternals, target: Control) => {
  // an unbaselined root is one whose data has never arrived - there is nothing
  // to restore to, and writing `undefined` is what an async control refuses
  // outright
  if (form._roots.has(target[INTERNALS]._root)) {
    setValue(target, getBaseline(form, target));
  }

  clearUnder(form, target);
};

const makeForm = (control: Control, options: FormOptions): FormInternals => {
  const entries = new Map<Control, FieldEntry>();

  const form: FormInternals = {
    _control: control,
    _entries: entries,
    _validators: [],
    _blurValidators: [],
    _roots: new Map(),
    _armedRoots: new Map(),
    _options: options,
    _errorCount: 0,
    _pendingCount: 0,
    _dirtyCount: 0,
    _attached: false,
    _isSubmitting: false,
    _submittingControl: undefined,
    _validatingControl: undefined,
    _validControl: undefined,
    _dirtyControl: undefined,
    get $isSubmitting() {
      return (form._submittingControl ||= createPrimitiveControl(
        form._isSubmitting
      ));
    },
    get $isValidating() {
      return (form._validatingControl ||= createPrimitiveControl(
        !!form._pendingCount
      ));
    },
    get $isValid() {
      return (form._validControl ||= createPrimitiveControl(!form._errorCount));
    },
    get $isDirty() {
      return form._dirtyControl || startDirtyTracking(form);
    },
    validate() {
      return validateAll(form);
    },
    async submit(event) {
      // a click handler's default is the button's own behaviour
      if (event && event.type === 'submit') {
        event.preventDefault();
      }

      if (!form._isSubmitting) {
        setSubmitting(form, true);

        try {
          const { submit, submitFailed } = form._options;

          if (await validateAll(form)) {
            const values = getValue(control);

            // describes what is being sent, not what was typed while it was
            // in flight - and not walked for a handler that never asked
            let changed: readonly string[] = EMPTY_ARR;

            if (submit.length > 1) {
              const path = control[INTERNALS]._path;

              const start = path ? path.length : 0;

              const paths: string[] = [];

              const it = entries.values();

              for (let i = entries.size; i--;) {
                const entry = it.next().value!;

                const entryPath = entry._control[INTERNALS]._path;

                // a path no longer than the form control's own is the form
                // control, which knows the subtree moved but not where
                if (
                  entryPath &&
                  entryPath.length > start &&
                  isUnder(control, entry._control) &&
                  isNotEqual(getValue(entry._control), snapshotOf(entry))
                ) {
                  paths.push(entryPath.slice(start).join('.'));
                }
              }

              changed = paths;
            }

            await submit(values, changed as any);
          } else {
            // the first invalid field in the document, not in registration
            // order. An error of a whole subtree - a duplicate an array
            // reported, a group rule - marks no field of its own, so the first
            // field under what it validates stands in
            let focused: HTMLElement | undefined;

            const consider = (entry: FieldEntry) => {
              const element = entry._element;

              // DOCUMENT_POSITION_PRECEDING
              if (
                element &&
                (focused === undefined ||
                  focused.compareDocumentPosition(element) & 2)
              ) {
                focused = element;
              }
            };

            const considerUnder = (target: Control) => {
              const it = entries.values();

              for (let i = entries.size; i--;) {
                const entry = it.next().value!;

                if (isUnder(target, entry._control)) {
                  consider(entry);
                }
              }
            };

            const validators = form._validators;

            for (let i = 0; i < validators.length; i++) {
              const validator = validators[i];

              if (validator._invalid) {
                const marked = validator._marked;

                if (marked.length) {
                  for (let j = marked.length; j--;) {
                    const entry = marked[j];

                    if (entry._element) {
                      consider(entry);
                    } else {
                      considerUnder(entry._control);
                    }
                  }
                } else {
                  const controls = validator._controls;

                  for (let j = 0; j < controls.length; j++) {
                    considerUnder(controls[j]);
                  }
                }
              }
            }

            if (focused) {
              focused.focus();
            }

            if (submitFailed) {
              await submitFailed();
            }
          }
        } finally {
          setSubmitting(form, false);
        }
      }
    },
    reset(target?: Control, value?: any) {
      // `undefined` is a value to reset to, so only the count tells restoring
      // from writing
      if (arguments.length > 1) {
        const internals = target![INTERNALS];

        const path = internals._path;

        const root = internals._root;

        const roots = form._roots;

        // the baseline moves without a value being touched, so dirtiness is
        // recomputed here - nothing changed for the fields, what they compare
        // against did
        roots.set(root, path ? setIn(roots.get(root), path, 0, value) : value);

        if (form._dirtyControl) {
          const it = entries.values();

          for (let i = entries.size; i--;) {
            const entry = it.next().value!;

            if (isUnder(target!, entry._control)) {
              setEntryDirty(
                form,
                entry,
                isNotEqual(getValue(entry._control), snapshotOf(entry))
              );
            }
          }
        }

        setValue(target!, value);

        clearUnder(form, target!);
      } else if (target) {
        restore(form, target);
      } else {
        // the form control covers every path under it; the fields outside are
        // reachable one by one
        restore(form, control);

        const it = entries.values();

        for (let i = entries.size; i--;) {
          const entry = it.next().value!;

          if (!isUnder(control, entry._control)) {
            setValue(entry._control, snapshotOf(entry));

            clearUnder(form, entry._control);
          }
        }
      }
    },
    focus(target) {
      const entry = entries.get(target);

      const element = entry && entry._element;

      if (element) {
        element.focus();

        return true;
      }

      return false;
    },
  };

  // a field of its own, so `$isDirty` sees paths nothing is mounted on - the
  // mount is what holds it, the way a field's does
  getEntry(form, control);

  return form;
};

export default makeForm;
