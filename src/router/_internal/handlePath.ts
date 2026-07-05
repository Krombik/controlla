import noop from 'lodash.noop';
import { INTERNALS } from '#internal/constants';
import type {
  HandleParse,
  HandleStringify,
  Path,
  PathParam,
  QueryParam,
  RouteData,
  RouterContext,
} from '#router/internal/types';
import type { AnchorParam } from '#router/anchor';
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
    routerContext: RouterContext,
    isMatchedRoot: PrimitiveControlInternals,
    source: Control,
    routeData: RouteData
  ) => AsyncControl | Control,
  source?: AsyncControl
): Path => {
  const parsers = new Map<string, HandleParse>();

  const stringifies = new Map<string, HandleStringify>();

  const _path: string[] = [];

  const pathParams: string[] = [];

  const queryParams: string[] = [];

  let end = path.length;

  let children: Record<string, Path> | undefined;

  let anchorParam: AnchorParam | undefined;

  let regexStr = '';

  // trailing slots, scanned from the end: [...segments, query?, anchor?, children?]
  if (end) {
    let last = path[end - 1];

    if (typeof last == 'object' && !('_anchor' in last)) {
      children = last as Record<string, Path>;

      last = path[--end - 1];
    }

    if (end && typeof last == 'object' && '_anchor' in last) {
      anchorParam = last as AnchorParam;

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
    _getParse: parsers.size ? parsers.get.bind(parsers) : noop,
    _getStringify: stringifies.size ? stringifies.get.bind(stringifies) : noop,
    _pathParams: pathParams,
    _queryParams: queryParams,
    _path,
    _anchor: anchorParam,
    _source: source && source[INTERNALS],
    _createControlScope: createControlScope,
  } as Path;
};

export default handlePath;
