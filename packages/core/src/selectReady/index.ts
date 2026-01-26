import type {
  AsyncControl,
  LoadableControl,
  ReadonlyAsyncControl,
} from '#types';
import { INTERNALS } from '#shared-internal/constants';

/** Makes the given {@link control} to be awaited only, without triggering re-renders on control changes. */
const selectReady = <S extends ReadonlyAsyncControl>(
  control: S
): S extends LoadableControl<any, infer E, infer C>
  ? LoadableControl<true, E, C>
  : S extends AsyncControl<any, infer E>
    ? AsyncControl<true, E>
    : S extends ReadonlyAsyncControl<any, infer E>
      ? ReadonlyAsyncControl<true, E>
      : never => control[INTERNALS]._root._readyControl as any;

export default selectReady;
