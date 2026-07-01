import type { RouteControls } from '#router/internal/types';
import type { ReadonlyControl } from '#types';

/**
 * Returns the hash control of the given {@link route} — its value is the
 * current URL hash while the route is matched (set via navigation or
 * `updateParams`), `undefined` otherwise. Throws if the route's path was
 * created without `anchor()`.
 */
const selectHash = (
  route: RouteControls<any>
): ReadonlyControl<string | undefined> => {
  const anchorParam = route._anchor;

  if (!anchorParam) {
    throw new Error('the route has no anchor');
  }

  return anchorParam._hashControl;
};

export default selectHash;
