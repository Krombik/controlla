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
import isNotEqual from '#internal/isNotEqual';

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
  // data that has never arrived is nothing to restore to, and writing
  // `undefined` is what an async control refuses outright. Outside the form
  // control there is no baseline at all - reading one down its path would be
  // reading the form's own value at that path
  if (form._baselined && isUnder(form._control, target)) {
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
    _baseline: undefined,
    _baselined: false,
    _options: options,
    _errorCount: 0,
    _pendingCount: 0,
    _dirtyCount: 0,
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
                  entry._tracked &&
                  entryPath &&
                  entryPath.length > start &&
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

        // only what the form is over has a baseline for this to move, and only
        // once there is one to move: writing a path into nothing would make a
        // baseline out of that path alone, and every other field would read
        // dirty against what it never got. The value written here is part of
        // whatever the form baselines against when it does
        if (form._baselined && isUnder(control, target!)) {
          const path = internals._path;

          // the baseline moves without a value being touched, so dirtiness is
          // recomputed here - nothing changed for the fields, what they compare
          // against did
          form._baseline = path ? setIn(form._baseline, path, 0, value) : value;

          form._baselined = true;

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
        }

        setValue(target!, value);

        clearUnder(form, target!);
      } else if (target) {
        restore(form, target);
      } else {
        restore(form, control);

        const it = entries.values();

        // a field outside the form control has no baseline to go back to, but
        // the rules the form holds on it are still the form's to clear
        for (let i = entries.size; i--;) {
          const entry = it.next().value!;

          if (!entry._tracked) {
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
