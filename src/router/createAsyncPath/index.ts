import type { AsyncControl } from '#types';
import handlePath from '#router/internal/handlePath';
import type {
  CreatePath,
  Path,
  PathParam,
  QueryParam,
  RouteData,
} from '#router/internal/types';
import createAsyncDerivedControl from '#core/createAsyncDerivedControl';
import type { PrimitiveControlInternals } from '#internal/types';
import { getCurrentLane } from '#internal/flushQueue';
import { getRouterPatch } from '#router/internal/state';

const makeControl = (
  isMatchedRoot: PrimitiveControlInternals,
  source: AsyncControl,
  routeData: RouteData,
  strings: Record<string, string | undefined>
) =>
  createAsyncDerivedControl(source, (value) => {
    if (isMatchedRoot._value) {
      const params = {};

      const initial = routeData._initial === true;

      routeData._initial = false;

      routeData._parsePath(params, strings, value, initial);

      routeData._parseQuery(params, strings, value, initial);

      getRouterPatch(getCurrentLane()!);

      return params;
    }
  });

const createAsyncPath: {
  <S>(source: AsyncControl<S>): CreatePath<S>;
} =
  (source: AsyncControl) =>
  (
    ...path: Array<
      | string
      | PathParam<Record<string, any>>
      | Record<string, Path>
      | QueryParam<Record<string, any>>
    >
  ): any =>
    handlePath(path, makeControl, source);

export default createAsyncPath;
