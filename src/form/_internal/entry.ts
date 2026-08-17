import type { Control } from '#types';
import type { FieldEntry, FormInternals } from '#form/internal/types';
import type { AsyncControlInternals, ChangeListener } from '#internal/types';
import type { FieldState } from '#form/types';
import { INTERNALS } from '#internal/constants';
import createDerivedControl from '#core/createDerivedControl';
import createPrimitiveControl from '#core/createPrimitiveControl';
import getValue from '#core/getValue';
import setValue from '#core/setValue';
import watchValue from '#core/watchValue';
import { addListener } from '#internal/flushQueue';
import reportError from '#internal/reportError';
import isNotEqual from '#form/internal/isNotEqual';
import identity from '#internal/identity';
import noop from '#internal/noop';

/**
 * Every value a load hands over is a baseline - the first one and every reload
 * after it. A plain listener: the form must not be what starts the load.
 */
const watchLoads = (form: FormInternals, root: AsyncControlInternals) => {
  const armed = form._armedRoots;

  if (!armed.has(root)) {
    const listener: ChangeListener = (value) => {
      // the loading status is written after this, so it still tells a load
      // apart from an edit
      if (value !== undefined && root._loadingControl[INTERNALS]._value) {
        form._roots.set(root, value);

        // the fields were notified before this moved what they compare
        // against, so their dirtiness is a step behind
        if (form._dirtyControl) {
          const entries = form._entries;

          const it = entries.values();

          for (let i = entries.size; i--;) {
            const entry = it.next().value!;

            if (entry._control[INTERNALS]._root === root) {
              setEntryDirty(
                form,
                entry,
                isNotEqual(getValue(entry._control), snapshotOf(entry))
              );
            }
          }
        }
      }
    };

    armed.set(root, listener);

    // before the mount its effect subscribes these, so a render that never
    // commits leaves nothing behind
    if (form._attached) {
      addListener(root, listener);
    }
  }
};

/**
 * The whole root at once, so every field of it compares against the same
 * moment. An async root that hasn't arrived is left alone - `undefined` would
 * make every field of it dirty when the data lands.
 */
export const getBaseline = (form: FormInternals, control: Control) => {
  const internals = control[INTERNALS];

  const roots = form._roots;

  const root = internals._root;

  let value: any;

  if (roots.has(root)) {
    value = roots.get(root);
  } else {
    value = root._value;

    if ((root as Partial<AsyncControlInternals>)._errorControl) {
      watchLoads(form, root as AsyncControlInternals);

      if (value !== undefined) {
        roots.set(root, value);
      }
    } else {
      roots.set(root, value);
    }
  }

  const path = internals._path;

  if (path) {
    for (let i = 0; i < path.length && value != null; i++) {
      value = value[path[i]];
    }
  }

  return value;
};

/** The value `reset` restores this field to, and `$isDirty` compares it against. */
export const snapshotOf = (entry: FieldEntry) =>
  entry._form ? getBaseline(entry._form, entry._control) : entry._snapshot;

/** Whether {@link control} is {@link target} or sits under it. */
export const isUnder = (target: Control, control: Control) => {
  const targetInternals = target[INTERNALS];

  const internals = control[INTERNALS];

  if (targetInternals._root !== internals._root) {
    return false;
  }

  const path = targetInternals._path;

  if (path === undefined) {
    return true;
  }

  const controlPath = internals._path;

  if (controlPath === undefined || controlPath.length < path.length) {
    return false;
  }

  for (let i = 0; i < path.length; i++) {
    if (controlPath[i] !== path[i]) {
      return false;
    }
  }

  return true;
};

export const makeEntry = (
  control: Control,
  form: FormInternals | undefined
): FieldEntry => ({
  _control: control,
  _form: form,
  _validate: undefined,
  _mode: 'submit',
  _keep: false,
  _snapshot: form ? undefined : getValue(control),
  _dirty: false,
  _error: undefined,
  _pending: 0,
  _attempt: 0,
  _refs: 0,
  _unwatch: undefined,
  _unwatchDirty: undefined,
  _element: undefined,
  _native: undefined,
  _scheduler: undefined,
  _parse: identity,
  _format: identity,
  _errorId: undefined,
  _describedBy: undefined,
  _described: undefined,
  _invalid: false,
  _syncAria: noop,
  _errorControl: undefined,
  _validatingControl: undefined,
  _dirtyControl: undefined,
  _state: undefined,
  _props: undefined,
});

export const setEntryDirty = (
  form: FormInternals,
  entry: FieldEntry,
  dirty: boolean
) => {
  if (dirty != entry._dirty) {
    entry._dirty = dirty;

    if (entry._dirtyControl) {
      setValue(entry._dirtyControl, dirty);
    }

    setValue(form._dirtyControl!, !!(form._dirtyCount += dirty ? 1 : -1));
  }
};

/** The listener value, not the control - the flush isn't done with it yet. */
const watchDirty = (form: FormInternals, entry: FieldEntry) => {
  entry._unwatchDirty = watchValue(entry._control, (value) => {
    setEntryDirty(form, entry, isNotEqual(value, snapshotOf(entry)));
  });
};

export const startDirtyTracking = (form: FormInternals) => {
  let count = 0;

  const entries = form._entries;

  const it = entries.values();

  for (let i = entries.size; i--;) {
    const entry = it.next().value!;

    if (isNotEqual(getValue(entry._control), snapshotOf(entry))) {
      entry._dirty = true;

      count++;
    }

    watchDirty(form, entry);
  }

  form._dirtyCount = count;

  return (form._dirtyControl = createPrimitiveControl(!!count));
};

const setPending = (entry: FieldEntry, delta: number) => {
  const prevPending = entry._pending;

  const pending = (entry._pending = prevPending + delta);

  if (entry._validatingControl) {
    setValue(entry._validatingControl, !!pending);
  }

  const form = entry._form;

  if (form && !prevPending != !pending) {
    const count = (form._pendingCount += pending ? 1 : -1);

    if (form._validatingControl) {
      setValue(form._validatingControl, !!count);
    }
  }
};

export const setEntryError = (entry: FieldEntry, error: any) => {
  const prevError = entry._error;

  if (prevError !== error) {
    entry._error = error;

    if (entry._errorControl) {
      setValue(entry._errorControl, error);
    }

    const form = entry._form;

    if (form && (prevError === undefined) !== (error === undefined)) {
      const count = (form._errorCount += error === undefined ? -1 : 1);

      if (form._validControl) {
        setValue(form._validControl, !count);
      }
    }

    syncWatch(entry);

    entry._syncAria();
  }
};

export const runValidate = (entry: FieldEntry, value: any) => {
  const validate = entry._validate;

  if (!validate) {
    return;
  }

  const attempt = ++entry._attempt;

  const result = validate(value);

  if (!result || typeof result.then != 'function') {
    setEntryError(entry, result);

    return;
  }

  setPending(entry, 1);

  return (result as Promise<any>).then(
    (error) => {
      setPending(entry, -1);

      if (attempt == entry._attempt) {
        setEntryError(entry, error);
      }
    },
    (err) => {
      setPending(entry, -1);

      throw err;
    }
  );
};

/** Runs a validation nobody awaits - a rejection surfaces instead of vanishing. */
export const triggerValidate = (entry: FieldEntry, value: any) => {
  const promise = runValidate(entry, value);

  if (promise) {
    promise.catch(reportError);
  }
};

/** An active error revalidates live until it clears, whatever the trigger. */
const syncWatch = (entry: FieldEntry) => {
  const shouldWatch =
    entry._validate !== undefined &&
    (entry._mode == 'change' || entry._error !== undefined);

  if (shouldWatch != (entry._unwatch !== undefined)) {
    if (shouldWatch) {
      entry._unwatch = watchValue(entry._control, (value) => {
        triggerValidate(entry, value);
      });
    } else {
      detachEntry(entry);
    }
  }
};

const detachEntry = (entry: FieldEntry) => {
  if (entry._unwatch) {
    entry._unwatch();

    entry._unwatch = undefined;
  }
};

/** Also the way back from an `Activity`, whose cleanup unregistered it. */
const attachEntry = (form: FormInternals, entry: FieldEntry) => {
  const control = entry._control;

  form._entries.set(control, entry);

  if (form._dirtyControl && !entry._unwatchDirty) {
    watchDirty(form, entry);

    setEntryDirty(
      form,
      entry,
      isNotEqual(getValue(control), snapshotOf(entry))
    );
  }
};

/** A mounted consumer: `Field` from its effect, `NativeField` from its ref. */
export const holdEntry = (entry: FieldEntry) => {
  // a field holds the validator it was mounted with, so once is enough - an
  // active error re-arms it through `setEntryError`
  syncWatch(entry);

  const form = entry._form;

  if (form) {
    // an `Activity` hides by unmounting, which is what carries the registration
    if (!form._entries.has(entry._control)) {
      attachEntry(form, entry);
    }

    entry._refs++;
  }
};

export const releaseEntry = (entry: FieldEntry) => {
  const form = entry._form;

  if (!form) {
    detachEntry(entry);
  } else if (!--entry._refs && !entry._keep) {
    form._entries.delete(entry._control);

    // an unregistered entry has nothing left to clear an error, so a
    // validation in flight is dropped instead of counting forever
    entry._attempt++;

    setEntryError(entry, undefined);

    detachEntry(entry);

    if (entry._unwatchDirty) {
      entry._unwatchDirty();

      entry._unwatchDirty = undefined;

      setEntryDirty(form, entry, false);
    }
  }
};

export const getEntry = (form: FormInternals, control: Control) => {
  let entry = form._entries.get(control);

  if (entry === undefined) {
    entry = makeEntry(control, form);

    // before anything can be edited through the field
    getBaseline(form, control);

    attachEntry(form, entry);
  }

  return entry;
};

export const getFieldState = (entry: FieldEntry): FieldState<any> =>
  (entry._state ||= {
    $field: entry._control,
    get $error() {
      return (entry._errorControl ||= createPrimitiveControl(entry._error));
    },
    get $isValidating() {
      return (entry._validatingControl ||= createPrimitiveControl(
        !!entry._pending
      ));
    },
    get $isDirty() {
      const form = entry._form;

      // a rebaseline moves dirtiness without touching the value, so this is
      // fed by `setEntryDirty` rather than derived - and that is what keeps
      // `_dirty`, which has to be running before seeding from it
      if (form) {
        if (!form._dirtyControl) {
          startDirtyTracking(form);
        }

        return (entry._dirtyControl ||= createPrimitiveControl(entry._dirty));
      }

      // no form is no rebaseline: the value is the only input left
      return (entry._dirtyControl ||= createDerivedControl(
        entry._control,
        (value) => isNotEqual(value, entry._snapshot)
      ));
    },
  });
