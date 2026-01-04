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
  const utils = control[ROOT];

  const root = utils[ROOT];

  return {
    [ROOT]:
      root != utils
        ? {
            [ROOT]: root,
            _get: noop,
            _subscribe: utils._subscribe,
            _subscribeWithError: utils._subscribeWithError,
            _subscribeWithLoad: utils._subscribeWithLoad,
            _path: utils._path,
            _awaitOnly: true,
          }
        : {
            [ROOT]: utils,
            _get: noop,
            _subscribe: utils._subscribe,
            _subscribeWithError: utils._subscribeWithError,
            _subscribeWithLoad: utils._subscribeWithLoad,
            _awaitOnly: true,
          },
  } as LoadableControl<any, any, any> as any;
};

export default awaitOnly;
