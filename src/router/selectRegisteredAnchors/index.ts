import type { AnchorRoute } from '#router/internal/types';
import type { ReadonlyControlScope } from '#types';

/**
 * Returns the reactive set of mounted anchor ids for the given {@link route}:
 * `true` per mounted id, `undefined` when not mounted. Drive a navigation
 * header that shows only the sections currently on the page.
 *
 * With a `trackScroll` anchor, the currently active id is `'active'`
 * instead of `true`.
 *
 * @example
 * ```tsx
 * const registered = useValue(selectRegisteredAnchors(route).filters);
 * // registered === 'active' | true | undefined
 * ```
 */
const selectRegisteredAnchors = <A extends string>(
  route: AnchorRoute<A>
): ReadonlyControlScope<Record<A, 'active' | true | undefined>> =>
  route._anchor!._registered as any;

export default selectRegisteredAnchors;
