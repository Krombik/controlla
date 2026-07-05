import handlePath from '#router/internal/handlePath';
import type {
  Path,
  PathParam,
  QueryParam,
  CreatePath,
} from '#router/internal/types';
import createControlScope from '#core/createControl';

const makeControl = () => createControlScope();

const createPath: CreatePath = (
  ...path: Array<
    | string
    | PathParam<Record<string, any>>
    | Record<string, Path>
    | QueryParam<Record<string, any>>
  >
): any => handlePath(path, makeControl);

export default createPath;
