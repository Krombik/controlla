import type {
  ParamParser,
  ParamStringifier,
  Path,
  PathParam,
  QueryParam,
  RouteData,
} from '#router/internal/types';
import type { AnchorParam } from '#router/internal/anchor';
import type { AsyncControl, Control } from '#types';
import type { PrimitiveControlInternals } from '#internal/types';

const handleSegment = (segment: string, path: string[]) => {
  segment = `/${segment}`;

  const l = path.length;

  if (l && path[l - 1][0] == '/') {
    path[l - 1] += segment;
  } else {
    path.push(segment);
  }

  return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const handlePath = (
  path: Array<
    | string
    | PathParam<Record<string, any>>
    | Record<string, Path>
    | QueryParam<Record<string, any>>
    | AnchorParam
  >,
  createControlScope: (
    isMatchedRoot: PrimitiveControlInternals,
    source: AsyncControl,
    routeData: RouteData,
    strings: Record<string, string | undefined>
  ) => AsyncControl | Control,
  source?: AsyncControl
): Path => {
  const parsers: Record<string, ParamParser> = {};

  const stringifies: Record<string, ParamStringifier> = {};

  const _path: string[] = [];

  const pathParams: string[] = [];

  const queryParams: string[] = [];

  let end = path.length;

  let children: Record<string, Path> | undefined;

  let anchorParam: AnchorParam | undefined;

  let regexStr = '';

  if (end) {
    let last = path[end - 1];

    if (typeof last == 'object') {
      if ((last as AnchorParam)._anchor !== true) {
        children = last as Record<string, Path>;
      } else {
        anchorParam = last as AnchorParam;
      }

      last = path[--end - 1];
    }

    if (end && typeof last == 'function' && last.length == 3) {
      (last as QueryParam<{}>)(parsers, stringifies, queryParams);

      end--;
    }
  }

  for (let i = 0; i < end; i++) {
    const segment = path[i] as string | PathParam<Record<string, any>>;

    regexStr +=
      typeof segment == 'string'
        ? handleSegment(segment, _path)
        : segment(parsers, stringifies, pathParams, _path);
  }

  return {
    _regexStr: regexStr,
    _children: children,
    _parsers: parsers,
    _stringifies: stringifies,
    _pathParams: pathParams,
    _queryParams: queryParams,
    _path,
    _anchor: anchorParam,
    _source: source,
    _createControlScope: createControlScope,
  } as Path;
};

export default handlePath;
