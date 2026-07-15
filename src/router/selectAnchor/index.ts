import getAnchorParam from '#router/internal/getAnchorParam';
import type { AnchorRoute } from '#router/internal/types';
import type { Control } from '#types';

/**
 * Returns the anchor control of the given {@link route}: settable via
 * navigation or `setValue`/`replaceValue`, an empty string when there is
 * none. Throws if the route's path was created without `anchor()`.
 */
const selectAnchor = <A extends string>(route: AnchorRoute<A>) =>
  getAnchorParam(route)._hashControl as Control<A | ''>;

export default selectAnchor;
