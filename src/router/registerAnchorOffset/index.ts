import getAnchorParam from '#router/internal/getAnchorParam';
import type { AnchorRoute } from '#router/internal/types';

/**
 * Registers the element the scroll-offset resolvers measure for
 * {@link route} (e.g. a sticky header). Returns a cached ref, safe to call
 * during render. Throws if the route's path was created without `anchor()`.
 *
 * @example
 * ```tsx
 * <header ref={registerAnchorOffset(route)} />
 * ```
 */
const registerAnchorOffset = <A extends string>(route: AnchorRoute<A>) => {
  const anchorParam = getAnchorParam(route);

  return (anchorParam._offsetRef ??= (el) => {
    anchorParam._offsetEl = el;
  });
};

export default registerAnchorOffset;
