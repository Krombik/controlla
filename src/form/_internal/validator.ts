import type { Control } from '#types';
import type {
  FieldEntry,
  FormInternals,
  ValidatorInternals,
} from '#form/internal/types';
import getValue from '#core/getValue';
import setValue from '#core/setValue';
import watchValue from '#core/watchValue';
import watchValues from '#core/watchValues';
import reportError from '#internal/reportError';
import removeFromArray from '#internal/removeFromArray';
import noop from '#internal/noop';
import { isUnder, markEntry, setEntryPending } from '#form/internal/entry';

/** Nothing to report reads as `undefined`, whichever way it was spelled. */
const normalize = (validator: ValidatorInternals, result: any) => {
  if (result === undefined || result === null) {
    return undefined;
  }

  if (validator._tuple) {
    for (let i = result.length; i--;) {
      if (result[i] !== undefined) {
        return result;
      }
    }

    return undefined;
  }

  return result;
};

/** Whether the {@link validator} validating covers this field. */
const covers = (validator: ValidatorInternals, control: Control) => {
  const controls = validator._controls;

  return validator._paths
    ? isUnder(controls[0], control)
    : controls.indexOf(control) >= 0;
};

/** An error revalidates live until it clears, whatever the trigger. */
const syncWatch = (validator: ValidatorInternals) => {
  const shouldWatch = validator._mode == 'change' || validator._invalid;

  if (shouldWatch != (validator._unwatch !== noop)) {
    if (shouldWatch) {
      const controls = validator._controls;

      const run = () => {
        trigger(validator);
      };

      validator._unwatch =
        controls.length > 1
          ? watchValues(controls as Control[], run)
          : watchValue(controls[0], run);
    } else {
      validator._unwatch();

      validator._unwatch = noop;
    }
  }
};

/**
 * Answers the form's validity and marks the fields the {@link error} names -
 * idempotent, so the watch of an error written from outside lands on the same
 * result as the run that wrote one.
 */
export const distribute = (validator: ValidatorInternals, error: any) => {
  const form = validator._form;

  const invalid = error !== undefined;

  if (invalid != validator._invalid) {
    validator._invalid = invalid;

    const count = (form._errorCount += invalid ? 1 : -1);

    if (form._validControl) {
      setValue(form._validControl, !count);
    }

    syncWatch(validator);
  }

  const prev = validator._marked;

  if (invalid || prev.length) {
    const next: FieldEntry[] = [];

    if (invalid) {
      const entries = form._entries;

      if (validator._paths) {
        const it = error.keys();

        for (let i = error.size; i--;) {
          const entry = entries.get(it.next().value!);

          if (entry) {
            next.push(entry);
          }
        }
      } else {
        const controls = validator._controls;

        for (let i = 0; i < controls.length; i++) {
          const entry = entries.get(controls[i]);

          if (entry && (validator._tuple ? error[i] : error) !== undefined) {
            next.push(entry);
          }
        }
      }
    }

    for (let i = prev.length; i--;) {
      if (next.indexOf(prev[i]) < 0) {
        markEntry(prev[i], -1);
      }
    }

    for (let i = next.length; i--;) {
      if (prev.indexOf(next[i]) < 0) {
        markEntry(next[i], 1);
      }
    }

    validator._marked = next;
  }
};

const setPending = (validator: ValidatorInternals, delta: number) => {
  const prev = validator._pending;

  const pending = (validator._pending = prev + delta);

  if (!prev != !pending) {
    const form = validator._form;

    const count = (form._pendingCount += pending ? 1 : -1);

    if (form._validatingControl) {
      setValue(form._validatingControl, !!count);
    }

    if (pending) {
      const covered: FieldEntry[] = (validator._pendingEntries = []);

      const entries = form._entries;

      if (validator._paths) {
        const it = entries.values();

        for (let i = entries.size; i--;) {
          const entry = it.next().value!;

          if (covers(validator, entry._control)) {
            covered.push(entry);
          }
        }
      } else {
        const controls = validator._controls;

        for (let i = 0; i < controls.length; i++) {
          const entry = entries.get(controls[i]);

          if (entry) {
            covered.push(entry);
          }
        }
      }

      for (let i = covered.length; i--;) {
        setEntryPending(covered[i], 1);
      }
    } else {
      const covered = validator._pendingEntries;

      validator._pendingEntries = [];

      for (let i = covered.length; i--;) {
        setEntryPending(covered[i], -1);
      }
    }
  }
};

const applyError = (validator: ValidatorInternals, error: any) => {
  if (validator._paths) {
    const prev = validator._reported!;

    const reported = new Map<Control, any>();

    if (error) {
      for (let i = error.length; i--;) {
        const entry = error[i];

        if (entry[1] !== undefined) {
          reported.set(entry[0], entry[1]);
        }
      }
    }

    validator._reported = reported;

    // only where the error moved, and only for a control someone asked about -
    // a list renders as many of those as it has rows
    const controls = validator._errorControls!;

    if (controls.size) {
      let it = reported.keys();

      for (let i = reported.size; i--;) {
        const control = it.next().value!;

        const errorControl = controls.get(control);

        if (errorControl && reported.get(control) !== prev.get(control)) {
          setValue(errorControl, reported.get(control));
        }
      }

      it = prev.keys();

      for (let i = prev.size; i--;) {
        const control = it.next().value!;

        if (!reported.has(control)) {
          const errorControl = controls.get(control);

          if (errorControl) {
            setValue(errorControl, undefined);
          }
        }
      }
    }

    // what it reported is what it failed on, whatever the rule handed back
    distribute(validator, reported.size ? reported : undefined);
  } else {
    setValue(validator._errorControl!, error);

    distribute(validator, error);
  }
};

const runValidator = (validator: ValidatorInternals) => {
  const attempt = ++validator._attempt;

  const controls = validator._controls;

  let values: any;

  if (validator._tuple) {
    values = Array(controls.length);

    for (let i = controls.length; i--;) {
      values[i] = getValue(controls[i]);
    }
  } else {
    values = getValue(controls[0]);
  }

  const result = validator._validate(values);

  if (!result || typeof result.then != 'function') {
    applyError(validator, normalize(validator, result));

    return;
  }

  setPending(validator, 1);

  return (result as Promise<any>).then(
    (error) => {
      setPending(validator, -1);

      if (attempt == validator._attempt) {
        applyError(validator, normalize(validator, error));
      }
    },
    (err) => {
      setPending(validator, -1);

      throw err;
    }
  );
};

/** Runs a validation nobody awaits - a rejection surfaces instead of vanishing. */
const trigger = (validator: ValidatorInternals) => {
  const promise = runValidator(validator);

  if (promise) {
    promise.catch(reportError);
  }
};

export const validateAll = async (form: FormInternals) => {
  const promises: Promise<void>[] = [];

  const validators = form._validators;

  for (let i = 0; i < validators.length; i++) {
    const promise = runValidator(validators[i]);

    if (promise) {
      promises.push(promise);
    }
  }

  await Promise.all(promises);

  return !form._errorCount;
};

/**
 * What leaving a field runs: the validators of it that validate on blur, which
 * is the only bucket walked here - a form with no such rule does nothing. What
 * they read is the control, which an element wrote as it was typed into.
 */
export const handleBlur = (form: FormInternals, control: Control) => () => {
  const validators = form._blurValidators;

  for (let i = 0; i < validators.length; i++) {
    const validator = validators[i];

    const controls = validator._controls;

    for (let j = 0; j < controls.length; j++) {
      if (isUnder(controls[j], control)) {
        trigger(validator);

        break;
      }
    }
  }
};

/**
 * A reset takes the errors of what it restored with it. One watching more than
 * that keeps its own: it holds an error, so it is watching its controls, and
 * the restored value is what runs it again - with the value, not before it.
 */
export const clearUnder = (form: FormInternals, target: Control) => {
  const validators = form._validators;

  for (let i = 0; i < validators.length; i++) {
    const validator = validators[i];

    const controls = validator._controls;

    for (let j = 0; j < controls.length; j++) {
      if (isUnder(target, controls[j])) {
        validator._attempt++;

        applyError(validator, undefined);

        break;
      }
    }
  }
};

/** A mounted rule: swept by the submit, and counted in `$isValid`. */
export const holdValidator = (validator: ValidatorInternals) => {
  const form = validator._form;

  if (form._validators.indexOf(validator) < 0) {
    form._validators.push(validator);

    if (validator._mode == 'blur') {
      form._blurValidators.push(validator);
    }
  }

  syncWatch(validator);
};

/** An unmounted rule takes its error, and a check in flight, with it. */
export const releaseValidator = (validator: ValidatorInternals) => {
  validator._attempt++;

  applyError(validator, undefined);

  validator._unwatch();

  validator._unwatch = noop;

  const form = validator._form;

  removeFromArray(form._validators, validator);

  if (validator._mode == 'blur') {
    removeFromArray(form._blurValidators, validator);
  }
};

/** Whatever the mounted validators already hold for a field that just arrived. */
export const seedEntry = (form: FormInternals, entry: FieldEntry) => {
  const validators = form._validators;

  for (let i = 0; i < validators.length; i++) {
    const validator = validators[i];

    // what it reported is what it marks, wherever that control sits - only
    // what it validates says whose validating it counts towards
    if (validator._invalid && validator._marked.indexOf(entry) < 0) {
      let error: any;

      if (validator._paths) {
        error = validator._reported!.get(entry._control);
      } else {
        const index = validator._controls.indexOf(entry._control);

        if (index >= 0) {
          error = getValue(validator._errorControl!);

          if (validator._tuple) {
            error = error[index];
          }
        }
      }

      if (error !== undefined) {
        validator._marked.push(entry);

        markEntry(entry, 1);
      }
    }

    if (
      validator._pending &&
      validator._pendingEntries.indexOf(entry) < 0 &&
      covers(validator, entry._control)
    ) {
      validator._pendingEntries.push(entry);

      setEntryPending(entry, 1);
    }
  }
};

/** A field that unregistered is nothing left to mark or to count. */
export const dropEntry = (form: FormInternals, entry: FieldEntry) => {
  const validators = form._validators;

  for (let i = 0; i < validators.length; i++) {
    const validator = validators[i];

    let index = validator._marked.indexOf(entry);

    if (index >= 0) {
      validator._marked.splice(index, 1);

      markEntry(entry, -1);
    }

    index = validator._pendingEntries.indexOf(entry);

    if (index >= 0) {
      validator._pendingEntries.splice(index, 1);

      setEntryPending(entry, -1);
    }
  }
};
