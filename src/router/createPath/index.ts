import handlePath from '#router/internal/handlePath';
import type {
  Path,
  PathParam,
  QueryParam,
  CreatePath,
} from '#router/internal/types';
import createControlScope from '#core/createControl';

const makeControl = () => createControlScope();

/**
 * Declares a path of the route tree. Accepts, in order: static segments and
 * `param(...)` path params, then an optional `query(...)`, then an optional
 * `anchor(...)`, then an optional children record: every piece is typed and
 * flows into the route's params control.
 *
 * @example
 * ```ts
 * const paths = {
 *   home: createPath(),
 *   product: createPath('product', param({ id: true }), {
 *     reviews: createPath('reviews'),
 *   }),
 *   catalog: createPath('catalog', query({ sort: true, page: true })),
 * };
 * ```
 */
const createPath: CreatePath = (
  ...path: Array<
    | string
    | PathParam<Record<string, any>>
    | Record<string, Path>
    | QueryParam<Record<string, any>>
  >
): any => handlePath(path, makeControl);

export default createPath;
