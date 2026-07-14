import type { PageRoute, RouteParams } from '#router/internal/types';
import type { ReadonlyControlScope } from '#types';

/**
 * Returns the reactive set of mounted anchor ids for the given {@link route}
 * (`true` per registered id) — drive a navigation header that shows only the
 * sections currently on the page. Pair with `selectHash` for the active one.
 * Throws if the route's path was created without `anchor()`.
 *
 * @example
 * ```tsx
 * const registered = useValue(selectRegisteredAnchors(route).filters);
 * ```
 */
const selectRegisteredAnchors = <A extends string>(
  route: PageRoute<true> & RouteParams<any, any, A>
): ReadonlyControlScope<Record<A, true | undefined>> => {
  const anchorParam = route._anchor;

  if (!anchorParam) {
    throw new Error('the route has no anchor');
  }

  return anchorParam._registered as any;
};

export default selectRegisteredAnchors;
