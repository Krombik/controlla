import { useContext, useLayoutEffect, useState } from 'react';
import type { AnyAsyncState, AsyncState, Falsy, ResolvedValue } from '../types';
import useNoop from '../utils/useNoop';
import ErrorBoundaryContext from '../utils/ErrorBoundaryContext';
import onValueChange from '../onValueChange';
import getValue from '../getValue';
import { RootKey } from '../utils/constants';
import SuspenseContext from '../utils/SuspenseContext';
import { handleLoad, handleUnload } from '../utils/handleSuspense';

const use = ((
  state: AnyAsyncState<any, any, any[]> | Falsy,
  safeReturn?: boolean
) => {
  const errorBoundaryCtx = useContext(ErrorBoundaryContext);

  const suspenseCtx = useContext(SuspenseContext);

  if (state) {
    const utils = state._internal;

    if (utils._data.has(RootKey.VALUE)) {
      const t = useState<{}>();

      useLayoutEffect(() => {
        const setValue = t[1];

        const forceRerender = () => {
          setValue({});
        };

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

      return safeReturn ? [getValue(state)] : getValue(state);
    }

    const errorData = utils._errorUtils._data;

    if (errorData.has(RootKey.VALUE)) {
      const unload = handleUnload(utils, errorBoundaryCtx, suspenseCtx);

      if (unload) {
        unload();
      }

      if (safeReturn) {
        return [undefined, errorData.get(RootKey.VALUE)];
      }

      throw errorData.get(RootKey.VALUE);
    }

    throw handleLoad(state, errorBoundaryCtx, suspenseCtx);
  }

  useNoop();
}) as {
  <S extends AsyncState<any> | Falsy, SafeReturn extends boolean = false>(
    state: S,
    safeReturn?: SafeReturn
  ): S extends AsyncState<infer T, infer E>
    ? SafeReturn extends false
      ? ResolvedValue<T>
      : Readonly<
          | [value: ResolvedValue<T>, error: undefined]
          | [value: undefined, error: E]
        >
    : undefined;
};

export default use;
