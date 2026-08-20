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
import { addListener, removeListener } from '#internal/flushQueue';
import isNotEqual from '#form/internal/isNotEqual';
import { dropEntry, seedEntry } from '#form/internal/validator';
import identity from '#internal/identity';
import noop from '#internal/noop';

/**
 * The first value a load hands over is the baseline. What comes after it is
 * not the form's business: whoever asked for a reload is who decides whether
 * what it brought is the new baseline. A plain listener: the form must not be
 * what starts the load.
 */
const watchFirstLoad = (form: FormInternals, root: AsyncControlInternals) => {
  const armed = form._armedRoots;

  if (!armed.has(root)) {
    const listener: ChangeListener = (value) => {
      if (value !== undefined) {
        removeListener(root, listener);

        armed.delete(root);

        form._roots.set(root, value);
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
 * The load watches of every root armed so far, subscribed by the mount. A
 * value that landed between the render that armed one and this is already its
 * baseline: the notify it came with had nobody to hear it, and the next one is
 * an edit.
 */
export const watchArmedLoads = (form: FormInternals) => {
  const armed = form._armedRoots;

  const it = armed.entries();

  for (let i = armed.size; i--;) {
    const item = it.next().value!;

    const root = item[0];

    const value = root._value;

    if (value !== undefined) {
      armed.delete(root);

      form._roots.set(root, value);
    } else {
      addListener(root, item[1]);
    }
  }
};

/**
 * The whole root at once, so every field of it compares against the same
 * moment. An async root that hasn't arrived is left alone: every path of it
 * reads `undefined`, which is what it compares against anyway.
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
      if (value !== undefined) {
        roots.set(root, value);
      } else {
        watchFirstLoad(form, root as AsyncControlInternals);
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
  _snapshot: form ? undefined : getValue(control),
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

    if (isNotEqual(getValue(entry._control), snapshotOf(entry))) {
      entry._dirty = true;

      count++;
    }

    watchDirty(form, entry);
  }

  form._dirtyCount = count;

  return (form._dirtyControl = createPrimitiveControl(!!count));
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

  // whatever the mounted validators already hold for it
  seedEntry(form, entry);
};

/** A mounted consumer: `Field` from its effect, `NativeField` from its ref. */
export const holdEntry = (entry: FieldEntry) => {
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

  if (form && !--entry._refs) {
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

    // before anything can be edited through the field
    getBaseline(form, control);

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
