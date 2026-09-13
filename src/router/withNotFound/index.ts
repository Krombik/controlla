import identity from '#internal/identity';
import createPath from '#router/createPath';
import type { AnyPaths, PathParam, WithNotFound } from '#router/internal/types';
import NOT_FOUND from '#router/NOT_FOUND';

const NAME = 'notFoundPath';

// the trailing `defaults` is unused, but `handlePath` tells a path declarator
// from a query one by arity
const notFoundPath = createPath(((
  parsers,
  stringifies,
  pathParams,
  path,
  _
) => {
  parsers[NAME] = (value) => value || '';

  stringifies[NAME] = identity;

  path.push(NAME);

  pathParams.push(NAME);

  return `(?:/(?<${NAME}>.*))?`;
}) as PathParam<{ [NAME]: [string, false] }>);

/**
 * Adds a catch-all route to a children record under the {@link NOT_FOUND}
 * symbol: it matches any URL the siblings beside it didn't, so a section of the
 * tree has a page of its own for one. The root already has one - `createRouter`
 * puts it there.
 *
 * @example
 * ```ts
 * const paths = {
 *   docs: createPath('docs', withNotFound({ intro: createPath('intro') })),
 * };
 *
 * const RouterView = createRouterView([
 *   [router.routes.docs.intro, IntroPage],
 *   [router.routes.docs[NOT_FOUND], DocsNotFoundPage],
 * ]);
 * ```
 */
const withNotFound = <Paths extends AnyPaths>(paths: Paths) =>
  ({
    ...paths,
    [NOT_FOUND]: notFoundPath,
  }) as WithNotFound<Paths>;

export default withNotFound;
