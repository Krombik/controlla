import type { AsyncControl, LoadableControl } from '@react-control/core/types';
import handlePath from '#utils/handlePath';
import type {
  CreatePath,
  Path,
  PathParam,
  QueryParamWithReplace,
} from '#_types';
import createAsyncControlScope from '@react-control/core/createAsyncControlScope';
import load from '@react-control/core/load';
import { ROOT } from '@react-control/core/_shared/constants';

const createAsyncPath: {
  <S>(source: AsyncControl<S>): CreatePath<S>;
} =
  (source: AsyncControl | LoadableControl) =>
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
        createAsyncControlScope(
          source[ROOT]._load &&
            ({ load: () => load(source as LoadableControl) } as any)
        ),
      source
    );

export default createAsyncPath;
