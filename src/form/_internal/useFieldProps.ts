import { useRef } from 'react';

import type { Control } from '#types';
import type { FieldEntry, FormInternals } from '#form/internal/types';
import type { FieldElement, FieldRenderProps } from '#form/types';
import { INTERNALS } from '#internal/constants';
import useValue from '#core/useValue';
import { getFieldState } from '#form/internal/entry';
import { handleBlur } from '#form/internal/validator';
import { getSchedulerLane, scheduleFlush } from '#internal/flushQueue';
import { replacing } from '#router/internal/replacing';
import syncScheduler from '#scheduler/syncScheduler';

type Cache = {
  _entry: FieldEntry;
  _props: FieldRenderProps;
};

/**
 * The wiring of a field something else renders. Reads the value and whether it
 * holds an error, so whoever calls this rerenders on both - which is what a
 * component taking a `value` prop does anyway.
 */
const useFieldProps = (
  control: Control,
  form: FormInternals,
  entry: FieldEntry,
  onChange: ((value: any) => void) | undefined,
  replace: boolean
): FieldRenderProps<any> => {
  const ref = useRef<Cache>(null);

  let cache = ref.current;

  // a changed control resolves to a different entry, which is a different field
  if (cache === null || cache._entry !== entry) {
    const control = entry._control;

    const internals = control[INTERNALS];

    const root = internals._root;

    const path = internals._path;

    // one field of a control lets go of its own element, not of the one
    // another field of the same control has bound
    let bound: FieldElement | undefined;

    ref.current = cache = {
      _entry: entry,
      _props: {
        name: path ? path.join('.') : undefined,
        // nothing binds to it here - it is what `focus` reaches the field by
        ref(element: FieldElement | null) {
          if (element) {
            entry._element = bound = element;
          } else if (entry._element === bound) {
            entry._element = undefined;
          }
        },
        onBlur: handleBlur(form, control),
        // the commit is sync: React restores a controlled element to the value
        // it last rendered once the event ends, so one landing a microtask
        // later comes back to a caret already dropped to the end. The callback
        // runs inside that same flush - what it sets commits with the value
        onChange(value: any) {
          const lane = getSchedulerLane(syncScheduler);

          // a write to router params is a history entry, and a field would
          // leave one per keystroke
          replacing._value = replace;

          try {
            root._enqueueSet(value, lane, false, path);
          } finally {
            replacing._value = false;
          }

          if (onChange) {
            if (lane._canScheduleFlush) {
              lane._beforeFlushHooks.push(() => onChange(value));
            } else {
              onChange(value);
            }
          }

          scheduleFlush(lane);
        },
        value: undefined,
        isError: false,
      },
    };
  }

  return {
    ...cache._props,
    value: useValue(control),
    isError: useValue(getFieldState(entry).$isError),
  };
};

export default useFieldProps;
