import createPrimitiveControl from '#core/createPrimitiveControl';
import scheduleSet from '#internal/scheduleSet';
import { INTERNALS } from '#internal/constants';
import type { Control, ReadonlyControl } from '#types';

const cache = new Map<string, Control<boolean>>();

/**
 * Returns a boolean control tracking whether the given media {@link query}
 * matches — kept in sync with `matchMedia`. The control is created once per
 * query and reused on later calls, so it's safe to call inline.
 *
 * @example
 * ```ts
 * const isMobile = useValue(mediaQuery('(max-width: 600px)'));
 * ```
 */
const mediaQuery = (query: string): ReadonlyControl<boolean> => {
  let $control = cache.get(query);

  if ($control === undefined) {
    // off-platform (ssr) nothing matches, and nothing can change
    const mql = typeof matchMedia != 'undefined' ? matchMedia(query) : null;

    cache.set(query, ($control = createPrimitiveControl(!!mql && mql.matches)));

    if (mql) {
      mql.onchange = (e) => {
        scheduleSet($control![INTERNALS]._root, e.matches, true);
      };
    }
  }

  return $control;
};

export default mediaQuery;
