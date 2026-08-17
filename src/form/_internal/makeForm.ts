import type { Control } from '#types';
import type { FieldEntry, FormInternals } from '#form/internal/types';
import type { FieldError, FormOptions } from '#form/types';
import { EMPTY_ARR, INTERNALS } from '#internal/constants';
import createPrimitiveControl from '#core/createPrimitiveControl';
import getValue from '#core/getValue';
import setValue from '#core/setValue';
import {
  getBaseline,
  getEntry,
  isUnder,
  runValidate,
  setEntryDirty,
  setEntryError,
  snapshotOf,
  startDirtyTracking,
} from '#form/internal/entry';
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

const validateAll = async (form: FormInternals) => {
  const promises: Promise<void>[] = [];

  const entries = form._entries;

  const it = entries.values();

  for (let i = entries.size; i--;) {
    const entry = it.next().value!;

    const promise = runValidate(entry, getValue(entry._control));

    if (promise) {
      promises.push(promise);
    }
  }

  await Promise.all(promises);

  return !form._errorCount;
};

const setSubmitting = (form: FormInternals, isSubmitting: boolean) => {
  form._isSubmitting = isSubmitting;

  if (form._submittingControl) {
    setValue(form._submittingControl, isSubmitting);
  }
};

/**
 * Moves a subtree's baseline without touching a value. Dirtiness is recomputed
 * here - nothing changed for the fields, what they compare against did.
 */
const rebaseline = (form: FormInternals, target: Control, value: any) => {
  const internals = target[INTERNALS];

  const path = internals._path;

  const root = internals._root;

  const roots = form._roots;

  roots.set(root, path ? setIn(roots.get(root), path, 0, value) : value);

  if (form._dirtyControl) {
    const entries = form._entries;

    const it = entries.values();

    for (let i = entries.size; i--;) {
      const entry = it.next().value!;

      if (isUnder(target, entry._control)) {
        setEntryDirty(
          form,
          entry,
          isNotEqual(getValue(entry._control), snapshotOf(entry))
        );
      }
    }
  }
};

const clearErrorsUnder = (form: FormInternals, target: Control) => {
  const entries = form._entries;

  const it = entries.values();

  for (let i = entries.size; i--;) {
    const entry = it.next().value!;

    if (isUnder(target, entry._control)) {
      // drops whatever async validation is in flight for it
      entry._attempt++;

      setEntryError(entry, undefined);
    }
  }
};

/** Writes {@link value} and makes it what the {@link target} restores to next time. */
const writeReset = (form: FormInternals, target: Control, value: any) => {
  rebaseline(form, target, value);

  setValue(target, value);

  clearErrorsUnder(form, target);
};

/** Restores the {@link target} to whatever it currently restores to. */
const restore = (form: FormInternals, target: Control) => {
  const { resetValue } = form._options;

  const control = form._control;

  // a `resetValue` only covers the form control's subtree
  if (resetValue !== undefined && isUnder(control, target)) {
    const path = target[INTERNALS]._path;

    let value = resetValue;

    if (path) {
      const from = control[INTERNALS]._path;

      for (
        let i = from ? from.length : 0;
        i < path.length && value != null;
        i++
      ) {
        value = value[path[i]];
      }
    }

    writeReset(form, target, value);
  } else {
    // an unbaselined root is one whose data has never arrived - there is
    // nothing to restore to, and writing `undefined` is what an async control
    // refuses outright
    if (form._roots.has(target[INTERNALS]._root)) {
      setValue(target, getBaseline(form, target));
    }

    clearErrorsUnder(form, target);
  }
};

const makeForm = (control: Control, options: FormOptions): FormInternals => {
  const entries = new Map<Control, FieldEntry>();

  const form: FormInternals = {
    _control: control,
    _entries: entries,
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

            // what was saved is the new baseline, so an edit made while the
            // submit was in flight stays dirty
            rebaseline(form, control, values);
          } else {
            const errors: FieldError[] | undefined = submitFailed
              ? []
              : undefined;

            let target: HTMLElement | undefined;

            const it = entries.values();

            for (let i = entries.size; i--;) {
              const entry = it.next().value!;

              if (entry._error !== undefined) {
                if (errors) {
                  errors.push({ control: entry._control, error: entry._error });
                }

                const element = entry._element;

                if (
                  element &&
                  // DOCUMENT_POSITION_PRECEDING - first in the document, not
                  // in registration order
                  (target === undefined ||
                    target.compareDocumentPosition(element) & 2)
                ) {
                  target = element;
                }
              }
            }

            if (target) {
              target.focus();
            }

            if (errors) {
              await submitFailed!(errors);
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
        writeReset(form, target!, value);
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

            entry._attempt++;

            setEntryError(entry, undefined);
          }
        }
      }
    },
    setError(target, error) {
      const entry = entries.get(target);

      if (entry) {
        setEntryError(entry, error);
      }
    },
  };

  // a field of its own, so `$isDirty` sees paths nothing is mounted on - held
  // by the form, so a field over the same control can't unmount it away
  getEntry(form, control)._refs++;

  return form;
};

export default makeForm;
