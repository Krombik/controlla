import createPrimitiveControl from '#core/createPrimitiveControl';
import setValue from '#core/setValue';
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
    const mql = matchMedia(query);

    cache.set(query, ($control = createPrimitiveControl(mql.matches)));

    mql.onchange = (e) => {
      setValue($control!, e.matches);
    };
  }

  return $control;
};

export default mediaQuery;
