import type { PageRoute, RouteParams } from '#router/internal/types';
import type { Control } from '#types';

/**
 * Returns the anchor control of the given {@link route} — its value is the
 * current anchor while the route is matched (set via navigation,
 * `setValue`/`replaceValue` or scroll spy), an empty string when there is none.
 * Throws if the route's path was created without `anchor()`.
 */
const selectAnchor = <A extends string>(
  route: [A] extends [never]
    ? never
    : PageRoute<true> & RouteParams<any, any, A>
) => {
  const anchorParam = route._anchor;

  if (!anchorParam) {
    throw new Error('the route has no anchor');
  }

  return anchorParam._hashControl as Control<A | ''>;
};

export default selectAnchor;
