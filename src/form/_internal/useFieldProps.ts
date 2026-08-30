import { useRef } from 'react';

import type { Control } from '#types';
import type { FieldEntry, FormInternals } from '#form/internal/types';
import type { FieldElement, FieldRenderProps } from '#form/types';
import { INTERNALS } from '#internal/constants';
import useValue from '#core/useValue';
import setValue from '#core/setValue';
import { getFieldState } from '#form/internal/entry';
import { handleBlur } from '#form/internal/validator';

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
  entry: FieldEntry
): FieldRenderProps<any> => {
  const ref = useRef<Cache>(null);

  let cache = ref.current;

  // a changed control resolves to a different entry, which is a different field
  if (cache === null || cache._entry !== entry) {
    const path = entry._control[INTERNALS]._path;

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
        onBlur: handleBlur(form, entry._control),
        onChange(value: any) {
          setValue(entry._control, value);
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
