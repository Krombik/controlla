import type { AsyncControl } from '#types';
import handlePath from '#router/internal/handlePath';
import type {
  CreatePath,
  Path,
  PathParam,
  QueryParamWithReplace,
} from '#router/internal/types';
import createAsyncControl from '#core/createAsyncControl';
import load from '#core/load';
import { INTERNALS } from '#internal/constants';

const createAsyncPath: {
  <S>(source: AsyncControl<S>): CreatePath<S>;
} =
  (source: AsyncControl) =>
  (
    ...path: Array<
      | string
      | PathParam<Record<string, any>>
      | Record<string, Path>
      | QueryParamWithReplace<Record<string, any>>
    >
  ): any =>
    handlePath(
      path,
      () =>
        createAsyncControl(
          source[INTERNALS]._root._load && ({ load: () => load(source) } as any)
        ),
      source
    );

export default createAsyncPath;
