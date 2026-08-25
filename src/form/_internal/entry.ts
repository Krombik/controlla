import type { Control } from '#types';
import type { FieldEntry, FormInternals } from '#form/internal/types';
import type { FieldState } from '#form/types';
import { INTERNALS } from '#internal/constants';
import createPrimitiveControl from '#core/createPrimitiveControl';
import getValue from '#core/getValue';
import setValue from '#core/setValue';
import watchValue from '#core/watchValue';
import isNotEqual from '#internal/isNotEqual';
import { dropEntry, seedEntry } from '#form/internal/validator';
import identity from '#internal/identity';
import noop from '#internal/noop';

/**
 * Whatever the form was baselined at, down this control's path. Until it has
 * one - a load it is still waiting for - this is the value itself, so nothing
 * reads dirty against a baseline that isn't there yet.
 */
export const getBaseline = (form: FormInternals, control: Control) => {
  const internals = control[INTERNALS];

  let value = form._baselined ? form._baseline : internals._root._value;

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
  getBaseline(entry._form, entry._control);

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

const makeEntry = (control: Control, form: FormInternals): FieldEntry => ({
  _control: control,
  _form: form,
  _tracked: isUnder(form._control, control),
  _dirty: false,
  _errorCount: 0,
  _pendingCount: 0,
  _refs: 0,
  _unwatchDirty: undefined,
  _element: undefined,
  _native: undefined,
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

/** One validator started or stopped marking this field. */
export const markEntry = (entry: FieldEntry, delta: number) => {
  const prev = entry._errorCount;

  const count = (entry._errorCount = prev + delta);

  if (!prev != !count) {
    if (entry._errorControl) {
      setValue(entry._errorControl, !!count);
    }

    entry._syncAria();
  }
};

/** One validator covering this field went in or out of flight. */
export const setEntryPending = (entry: FieldEntry, delta: number) => {
  const prev = entry._pendingCount;

  const count = (entry._pendingCount = prev + delta);

  if (!prev != !count && entry._validatingControl) {
    setValue(entry._validatingControl, !!count);
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

    if (entry._tracked) {
      if (isNotEqual(getValue(entry._control), snapshotOf(entry))) {
        entry._dirty = true;

        count++;
      }

      watchDirty(form, entry);
    }
  }

  form._dirtyCount = count;

  return (form._dirtyControl = createPrimitiveControl(!!count));
};

/** Also the way back from an `Activity`, whose cleanup unregistered it. */
const attachEntry = (form: FormInternals, entry: FieldEntry) => {
  const control = entry._control;

  form._entries.set(control, entry);

  if (entry._tracked && form._dirtyControl && !entry._unwatchDirty) {
    watchDirty(form, entry);

    setEntryDirty(
      form,
      entry,
      isNotEqual(getValue(control), snapshotOf(entry))
    );
  }

  // whatever the mounted validators already hold for it
  seedEntry(form, entry);
};

/** A mounted consumer: `Field` from its effect, `NativeField` from its ref. */
export const holdEntry = (entry: FieldEntry) => {
  const form = entry._form;

  const control = entry._control;

  // an `Activity` hides by unmounting, which is what carries the registration
  if (!form._entries.has(control)) {
    attachEntry(form, entry);
  }

  entry._refs++;
};

export const releaseEntry = (entry: FieldEntry) => {
  const form = entry._form;

  if (!--entry._refs) {
    form._entries.delete(entry._control);

    // an unregistered field is nothing to mark, and nothing to keep counting
    dropEntry(form, entry);

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

    attachEntry(form, entry);
  }

  return entry;
};

export const getFieldState = (entry: FieldEntry): FieldState<any> =>
  (entry._state ||= {
    $field: entry._control,
    get $isError() {
      return (entry._errorControl ||= createPrimitiveControl(
        !!entry._errorCount
      ));
    },
    get $isValidating() {
      return (entry._validatingControl ||= createPrimitiveControl(
        !!entry._pendingCount
      ));
    },
    get $isDirty() {
      const form = entry._form;

      // a rebaseline moves dirtiness without touching the value, so this is
      // fed by `setEntryDirty` rather than derived - and that is what keeps
      // `_dirty`, which has to be running before seeding from it
      if (!form._dirtyControl) {
        startDirtyTracking(form);
      }

      return (entry._dirtyControl ||= createPrimitiveControl(entry._dirty));
    },
  });
