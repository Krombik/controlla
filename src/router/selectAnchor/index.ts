import type { AnchorRoute } from '#router/internal/types';
import type { Control } from '#types';

/**
 * Returns the anchor control of the given {@link route}: settable via
 * navigation or `setValue`/`replaceValue`, an empty string when there is
 * none.
 */
const selectAnchor = <A extends string>(route: AnchorRoute<A>) =>
  route._anchor!._hashControl as Control<A | ''>;

export default selectAnchor;
