import type { AsyncControl } from '#types';
import handlePath from '#router/internal/handlePath';
import type {
  CreatePath,
  Path,
  PathParam,
  QueryParam,
  RouteData,
} from '#router/internal/types';
import createAsyncDerivedControl from '#core/createAsyncDerivedControl';
import type { PrimitiveControlInternals } from '#internal/types';
import { getCurrentLane } from '#internal/flushQueue';
import { getRouterPatch } from '#router/internal/state';

const makeControl = (
  isMatchedRoot: PrimitiveControlInternals,
  source: AsyncControl,
  routeData: RouteData,
  strings: Record<string, string | undefined>
) =>
  createAsyncDerivedControl(source, (value) => {
    if (isMatchedRoot._value) {
      const params = {};

      const initial = routeData._initial === true;

      routeData._initial = false;

      routeData._parsePath(params, strings, value, initial);

      routeData._parseQuery(params, strings, value, initial);

      getRouterPatch(getCurrentLane()!);

      return params;
    }
  });

/**
 * A `createPath` whose params need async data to be parsed. Pass the async
 * {@link source} control first: every `parse`, `stringify`, `isValid` and
 * default of the path's params then receives the source's value as its
 * second argument.
 *
 * The route matches as usual, but its params control is async: `undefined`
 * until the {@link source} is ready, the parsed params after. If the source changes
 * later, the params are re-parsed from the same URL strings, and when that
 * produces different values, the URL is rewritten in place to match.
 *
 * Unlike a plain `createPath`, where a parse failure with no `fallbackValue`
 * just makes the route not match, here the route still matches - the params
 * control commits an error instead of a value.
 *
 * @example
 * ```ts
 * // /product/laptops, the slug is resolved through an async dictionary
 * const product = createAsyncPath($categories)(
 *   'product',
 *   param({
 *     category: {
 *       parse: (slug, categories) => categories.bySlug[slug],
 *       stringify: (category) => category.slug,
 *     },
 *   })
 * );
 * ```
 */
const createAsyncPath: {
  <S>(source: AsyncControl<S>): CreatePath<S>;
} =
  (source: AsyncControl) =>
  (
    ...path: Array<
      | string
      | PathParam<Record<string, any>>
      | Record<string, Path>
      | QueryParam<Record<string, any>>
    >
  ): any =>
    handlePath(path, makeControl, source);

export default createAsyncPath;
