import identity from 'lodash.identity';
import createPath from '../createPath';
import type { AnyPaths, Path, PathParam } from '../createPath/types';
import NOT_FOUND from '../NOT_FOUND';

const NAME = 'notFoundPath';

const restPath = ((parsers, stringifies, pathParams, path) => {
  parsers.set(NAME, (target, key, value) => {
    target[key] = value || '';

    return false;
  });

  stringifies.set(NAME, identity);

  path.push(NAME);

  pathParams.push(NAME);

  return `(?:/(?<${NAME}>.*))?`;
}) as PathParam<{ [NAME]: [string, false] }>;

const withNotFound = <Paths extends AnyPaths>(
  paths: Paths
): Paths & { [NOT_FOUND]: Path<never, { [NAME]: string }> } => ({
  ...paths,
  [NOT_FOUND]: createPath(restPath),
});

export default withNotFound;
