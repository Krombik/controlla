import type { Control } from '#types';
import type { FieldEntry, FormInternals } from '#form/internal/types';
import type { FieldError, FormOptions } from '#form/types';
import { EMPTY_ARR, INTERNALS } from '#internal/constants';
import createPrimitiveControl from '#core/createPrimitiveControl';
import getValue from '#core/getValue';
import setValue from '#core/setValue';
import {
  focusFirstError,
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

/**
 * The paths under the form control whose fields no longer match their
 * baseline, relative to it - what a patch would carry.
 *
 * Only registered fields are in it: a path nothing is mounted on is covered by
 * the form control's own entry, which knows the subtree moved but not where.
 */
const changedPaths = (form: FormInternals) => {
  const control = form._control;

  const path = control[INTERNALS]._path;

  const start = path ? path.length : 0;

  const changed: string[] = [];

  const entries = form._entries;

  const it = entries.values();

  for (let i = entries.size; i--;) {
    const entry = it.next().value!;

    const entryPath = entry._control[INTERNALS]._path;

    // a path no longer than the form control's own is the form control
    if (
      entryPath &&
      entryPath.length > start &&
      isUnder(control, entry._control) &&
      isNotEqual(getValue(entry._control), snapshotOf(entry))
    ) {
      changed.push(entryPath.slice(start).join('.'));
    }
  }

  return changed;
};

const setSubmitting = (form: FormInternals, isSubmitting: boolean) => {
  form._isSubmitting = isSubmitting;

  if (form._submittingControl) {
    setValue(form._submittingControl, isSubmitting);
  }
};

/**
 * Moves the baseline of the {@link target}'s subtree without touching a
 * value - a submit that went through, or a `reset` to a value of its own.
 *
 * Dirtiness is recomputed here rather than left to the change listeners:
 * nothing has to change for a field to stop being dirty, the thing it was
 * compared against did.
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

  // a `resetValue` only covers the form control's own subtree; a field over
  // anything else has nothing but its baseline
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
    setValue(target, getBaseline(form, target));

    clearErrorsUnder(form, target);
  }
};

const makeForm = (control: Control, options: FormOptions): FormInternals => {
  const entries = new Map<Control, FieldEntry>();

  const form: FormInternals = {
    _control: control,
    _entries: entries,
    _roots: new Map(),
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
      // only a form's own submit has a default worth stopping - a click
      // handler's would take the button's behaviour with it
      if (event && event.type === 'submit') {
        event.preventDefault();
      }

      if (!form._isSubmitting) {
        setSubmitting(form, true);

        try {
          const { submit, submitFailed } = form._options;

          if (await validateAll(form)) {
            const values = getValue(control);

            // taken before the handler runs, so it describes what is being
            // sent rather than whatever was typed while it was in flight - and
            // not walked at all for a handler that never declared it
            await submit(
              values,
              (submit.length > 1 ? changedPaths(form) : EMPTY_ARR) as any
            );

            // what was saved is the new baseline, so `$isDirty` means "changed
            // since it was last committed" - and an edit made while the submit
            // was in flight stays dirty
            rebaseline(form, control, values);
          } else {
            focusFirstError(form);

            if (submitFailed) {
              const errors: FieldError[] = [];

              const it = entries.values();

              for (let i = entries.size; i--;) {
                const entry = it.next().value!;

                if (entry._error !== undefined) {
                  errors.push({ control: entry._control, error: entry._error });
                }
              }

              await submitFailed(errors);
            }
          }
        } finally {
          setSubmitting(form, false);
        }
      }
    },
    reset(target?: Control, value?: any) {
      // `undefined` is a value someone can reset to, so only the count tells
      // restoring apart from writing
      if (arguments.length > 1) {
        writeReset(form, target!, value);
      } else if (target) {
        restore(form, target);
      } else {
        // the form control covers every path under it, mounted or not; the
        // fields outside it are only reachable one by one
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

  // the baseline has to be taken before anything can be edited - an async
  // control that hasn't arrived is skipped and taken by the first later read
  getBaseline(form, control);

  // the form control is a field of its own: it holds no validator, but it
  // baselines the whole subtree, so `$isDirty` sees paths nothing is mounted on
  getEntry(form, control);

  return form;
};

export default makeForm;
