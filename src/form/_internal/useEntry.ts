import { useLayoutEffect, useRef } from 'react';

import type { Control } from '#types';
import type { FieldEntry, FormInternals } from '#form/internal/types';
import {
  detachEntry,
  getEntry,
  makeEntry,
  removeEntry,
  syncWatch,
} from '#form/internal/entry';

/**
 * Resolves the registry entry of the {@link control}, creating it on the way -
 * or, outside of a form, a standalone one living for this component only.
 */
const useEntry = (form: FormInternals | undefined, control: Control) => {
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

  useLayoutEffect(() => {
    // the validator and the trigger are written during the render that just
    // finished, and a field holds the ones it was mounted with - so arming it
    // once is enough, and an active error re-arms it through `setEntryError`
    syncWatch(entry);

    if (!form) {
      return () => {
        detachEntry(entry);
      };
    }

    entry._refs++;

    return () => {
      if (!--entry._refs && !entry._keep) {
        removeEntry(form, entry);
      }
    };
  }, [entry]);

  return entry;
};

export default useEntry;
