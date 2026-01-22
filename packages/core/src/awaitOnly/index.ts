import noop from 'lodash.noop';
import type {
  AsyncControl,
  LoadableControl,
  ReadonlyAsyncControl,
} from '#types';
import { ROOT } from '#shared/constants';

/** Makes the given {@link control} to be awaited only, without triggering re-renders on control changes. */
const awaitOnly = <S extends ReadonlyAsyncControl>(
  control: S
): S extends LoadableControl<any, infer E, infer C>
  ? LoadableControl<void, E, C>
  : S extends AsyncControl<any, infer E>
    ? AsyncControl<void, E>
    : S extends ReadonlyAsyncControl<any, infer E>
      ? ReadonlyAsyncControl<void, E>
      : never => {
  const root = control[ROOT]._root;

  return {
    [ROOT]: {
      _root: root,
      _get: noop,
      _subscribe: root._subscribe,
      _watchValueChanges: false,
    },
  } as LoadableControl<any, any, any> as any;
};

export default awaitOnly;
