import identity from 'lodash.identity';
import createPath from '#router/createPath';
import type { AnyPaths, Path, PathParam } from '#router/internal/types';
import NOT_FOUND from '#router/NOT_FOUND';

const NAME = 'notFoundPath';

const notFoundPath = createPath(((parsers, stringifies, pathParams, path) => {
  parsers[NAME] = (value) => value || '';

  stringifies[NAME] = identity;

  path.push(NAME);

  pathParams.push(NAME);

  return `(?:/(?<${NAME}>.*))?`;
}) as PathParam<{ [NAME]: [string, false] }>);

const withNotFound = <Paths extends AnyPaths>(
  paths: Paths
): Paths & {
  [NOT_FOUND]: Path<never, { [NAME]: string }>;
} =>
  ({
    ...paths,
    [NOT_FOUND]: notFoundPath,
  }) as any;

export default withNotFound;
