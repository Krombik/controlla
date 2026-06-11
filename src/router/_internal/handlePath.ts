import noop from 'lodash.noop';
import returnFalse from '#internal/alwaysFalse';
import { INTERNALS } from '#internal/constants';
import type {
  HandleParse,
  HandleStringify,
  Path,
  PathParam,
  QueryParamWithReplace,
} from '#router/internal/types';
import type { AsyncControl, Control } from '#types';

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
    | QueryParamWithReplace<Record<string, any>>
  >,
  createControlScope: () => AsyncControl | Control,
  source?: AsyncControl
): Path => {
  const parsers = new Map<string, HandleParse>();

  const stringifies = new Map<string, HandleStringify>();

  const _path: string[] = [];

  const pathParams: string[] = [];

  const queryParams: string[] = [];

  const l = path.length - 2;

  let children: Record<string, Path> | undefined;

  let regexStr = '';

  let replaceDeprecatedQueryParams: Path['_replaceDeprecatedQueryParams'] =
    returnFalse;

  if (l > -2) {
    if (l > -1) {
      for (let i = 0; i < l; i++) {
        let segment = path[i] as string | PathParam<Record<string, any>>;

        regexStr +=
          typeof segment == 'string'
            ? handleSegment(segment, _path)
            : segment(parsers, stringifies, pathParams, _path);
      }

      const penultimate = path[l];

      if (typeof penultimate == 'string') {
        regexStr += handleSegment(penultimate, _path);
      } else if (penultimate.length == 4) {
        regexStr += (penultimate as PathParam<{}>)(
          parsers,
          stringifies,
          pathParams,
          _path
        );
      } else {
        replaceDeprecatedQueryParams = (
          penultimate as QueryParamWithReplace<{}>
        )(parsers, stringifies, queryParams);
      }
    }

    const last = path[l + 1];

    if (typeof last == 'object') {
      children = last;
    } else if (typeof last == 'string') {
      regexStr += handleSegment(last, _path);
    } else if (last.length == 4) {
      regexStr += (last as PathParam<{}>)(
        parsers,
        stringifies,
        pathParams,
        _path
      );
    } else {
      replaceDeprecatedQueryParams = (last as QueryParamWithReplace<{}>)(
        parsers,
        stringifies,
        queryParams
      );
    }
  }

  return {
    _regexStr: regexStr,
    _children: children,
    _getParse: parsers.size ? parsers.get.bind(parsers) : noop,
    _getStringify: stringifies.size ? stringifies.get.bind(stringifies) : noop,
    _replaceDeprecatedQueryParams: replaceDeprecatedQueryParams,
    _pathParams: pathParams,
    _queryParams: queryParams,
    _path,
    _source: source && source[INTERNALS],
    _createControlScope: createControlScope,
  } as Path;
};

export default handlePath;
