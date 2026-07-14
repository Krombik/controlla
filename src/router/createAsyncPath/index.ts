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
import addToQueue from '#internal/addToQueue';
import { getCurrentLane } from '#internal/flushQueue';
import { updateFinalizer } from '#router/internal/state';

const makeControl = (
  isMatchedRoot: PrimitiveControlInternals,
  source: AsyncControl,
  routeData: RouteData,
  strings: Record<string, string | undefined>
) =>
  createAsyncDerivedControl(source, (value) => {
    if (isMatchedRoot._value) {
      const params = {};

      routeData._extractPathParams(params, strings, value);

      routeData._extractQueryParams(params, strings, value);

      addToQueue(getCurrentLane()!, updateFinalizer);

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
