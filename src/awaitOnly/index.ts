import noop from 'lodash.noop';
import type { AsyncState, LoadableState } from '../types';
import { ROOT } from '../utils/constants';

/** Makes the given {@link state} to be awaited only, without triggering re-renders on state changes. */
const awaitOnly = <S extends AsyncState>(
  state: S
): S extends LoadableState<any, infer E, infer C>
  ? LoadableState<void, E, C>
  : S extends AsyncState<any, infer E>
    ? AsyncState<void, E>
    : never => {
  const utils = state[ROOT];

  const root = utils[ROOT];

  return {
    [ROOT]:
      root != utils
        ? {
            [ROOT]: root,
            _get: noop,
            _onValueChange: utils._onValueChange,
            _subscribeWithError: utils._subscribeWithError,
            _subscribeWithLoad: utils._subscribeWithLoad,
            _path: utils._path,
            _awaitOnly: true,
          }
        : {
            [ROOT]: utils,
            _get: noop,
            _onValueChange: utils._onValueChange,
            _subscribeWithError: utils._subscribeWithError,
            _subscribeWithLoad: utils._subscribeWithLoad,
            _awaitOnly: true,
          },
  } as LoadableState<any, any, any> as any;
};

export default awaitOnly;
