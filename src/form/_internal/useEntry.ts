import { useLayoutEffect, useRef } from 'react';

import type { Control } from '#types';
import type { FieldEntry, FormInternals } from '#form/internal/types';
import {
  getEntry,
  holdEntry,
  makeEntry,
  releaseEntry,
} from '#form/internal/entry';

/** The registry entry, or a standalone one for this component outside a form. */
const useEntry = (
  form: FormInternals | undefined,
  control: Control,
  byRef?: boolean
) => {
  const ref = useRef<FieldEntry>(null);

  let entry: FieldEntry;

  if (form) {
    entry = getEntry(form, control);
  } else {
    const local = ref.current;

    entry =
      local !== null && local._control === control
        ? local
        : (ref.current = makeEntry(control, undefined));
  }

  // a `NativeField` lives by its element, so its ref is what holds the entry -
  // a branch settled for the component's life
  if (!byRef) {
    useLayoutEffect(() => {
      holdEntry(entry);

      return () => {
        releaseEntry(entry);
      };
    }, [entry]);
  }

  return entry;
};

export default useEntry;
