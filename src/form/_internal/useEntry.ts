import { useEffect } from 'react';

import type { Control } from '#types';
import type { FormInternals } from '#form/internal/types';
import { getEntry, holdEntry, releaseEntry } from '#form/internal/entry';

/** The form's entry for this control, held for as long as the component is. */
const useEntry = (form: FormInternals, control: Control) => {
  const entry = getEntry(form, control);

  useEffect(() => {
    holdEntry(entry);

    return () => {
      releaseEntry(entry);
    };
  }, [entry]);

  return entry;
};

export default useEntry;
