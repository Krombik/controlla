import handlePath from '#router/internal/handlePath';
import type {
  Path,
  PathParam,
  QueryParamWithReplace,
  CreatePath,
} from '#router/internal/types';
import createControlScope from '#core/createControl';

const createPath: CreatePath = (
  ...path: Array<
    | string
    | PathParam<Record<string, any>>
    | Record<string, Path>
    | QueryParamWithReplace<Record<string, any>>
  >
): any => handlePath(path, createControlScope);

export default createPath;
