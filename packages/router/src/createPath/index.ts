import handlePath from '#utils/handlePath';
import type {
  Path,
  PathParam,
  QueryParamWithReplace,
  CreatePath,
} from '#_types';
import createControlScope from '@react-control/core/createControlScope';

const createPath: CreatePath = (
  ...path: Array<
    | string
    | PathParam<Record<string, any>>
    | Record<string, Path>
    | QueryParamWithReplace<Record<string, any>>
  >
): any => handlePath(path, createControlScope);

export default createPath;
