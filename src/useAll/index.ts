import { useContext, useLayoutEffect, useState } from 'react';
import type {
  AnyAsyncState,
  Falsy,
  ExtractValues,
  AsyncState,
  ExtractError,
} from '../types';
import onValueChange from '../onValueChange';
import getValue from '../getValue';
import noop from 'lodash.noop';
import ErrorBoundaryContext from '../utils/ErrorBoundaryContext';
import { RootKey } from '../utils/constants';
import { handleLoad, handleUnload } from '../utils/handleSuspense';
import SuspenseContext from '../utils/SuspenseContext';

const useAll = ((states: (AnyAsyncState | Falsy)[], safeReturn?: boolean) => {
  const l = states.length;

  const values: any[] = [];

  const errorBoundaryCtx = useContext(ErrorBoundaryContext);

  const suspenseCtx = useContext(SuspenseContext);

  const setValue = useState<{}>()[1];

  const forceRerender = () => {
    setValue({});
  };

  for (let i = 0; i < l; i++) {
    const state = states[i];

    if (state) {
      const utils = state._internal;

      const errorData = utils._errorUtils._data;

      if (errorData.has(RootKey.VALUE)) {
        if (safeReturn) {
          return [[], errorData.get(RootKey.VALUE)!];
        }

        throw errorData.get(RootKey.VALUE)!;
      }

      if (!utils._data.has(RootKey.VALUE)) {
        const unloadedStates: AnyAsyncState[] = [state];

        while (++i < l) {
          const state = states[i];

          if (state) {
            const utils = state._internal;

            const errorData = utils._errorUtils._data;

            if (errorData.has(RootKey.VALUE)) {
              if (safeReturn) {
                return [[], errorData.get(RootKey.VALUE)!];
              }

              throw errorData.get(RootKey.VALUE)!;
            }

            if (!utils._data.has(RootKey.VALUE)) {
              unloadedStates.push(state);
            }
          }
        }

        const promises: Promise<any>[] = [];

        for (let i = 0; i < unloadedStates.length; i++) {
          promises.push(
            handleLoad(unloadedStates[i], errorBoundaryCtx, suspenseCtx)
          );
        }

        throw Promise.all(promises);
      }

      useLayoutEffect(() => {
        const unlistenValue = onValueChange(state, forceRerender);

        const unlistenError = onValueChange(state.error, forceRerender);

        const unregister =
          'load' in state &&
          (handleUnload(utils, errorBoundaryCtx, suspenseCtx) || state.load());

        return () => {
          unlistenValue();

          unlistenError();

          unregister && unregister();
        };
      }, [utils, state._path && state._path.join('.')]);

      values.push(getValue(state));
    } else {
      values.push(useLayoutEffect(noop, [0, 0]));
    }
  }

  return safeReturn ? [values] : (values as ReadonlyArray<any>);
}) as {
  <
    const S extends (AsyncState<any> | Falsy)[],
    SafeReturn extends boolean = false,
  >(
    states: S,
    safeReturn?: SafeReturn
  ): SafeReturn extends false
    ? ExtractValues<S>
    : Readonly<
        | [values: ExtractValues<S>, error: undefined]
        | [values: readonly [], error: ExtractError<S>]
      >;
};

export default useAll;
