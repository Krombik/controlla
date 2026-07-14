import type { PageRoute } from '#router/internal/types';
import type { Control } from '#types';

/**
 * Returns the anchor control of the given {@link route} — its value is the
 * current anchor while the route is matched (set via navigation,
 * `setValue`/`replaceValue` or scroll spy), an empty string when there is none.
 * Throws if the route's path was created without `anchor()`.
 */
const selectAnchor = (route: PageRoute<true>): Control<string> => {
  const anchorParam = route._anchor;

  if (!anchorParam) {
    throw new Error('the route has no anchor');
  }

  return anchorParam._hashControl;
};

export default selectAnchor;
