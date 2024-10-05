import { useContext } from 'react';
import type { AnyAsyncState, AsyncState, Falsy } from '../types';
import useNoop from '../utils/useNoop';
import ErrorBoundaryContext from '../utils/ErrorBoundaryContext';
import SuspenseContext from '../utils/SuspenseContext';
import { handleLoad } from '../utils/handleSuspense';
import useHandleSuspenseValue from '../utils/useHandleSuspenseValue';
import useForceRerender from 'react-helpful-utils/useForceRerender';

const use = ((
  state: AnyAsyncState<any, any, any[]> | Falsy,
  safeReturn?: boolean
) => {
  const errorBoundaryCtx = useContext(ErrorBoundaryContext);

  const suspenseCtx = useContext(SuspenseContext);

  if (state) {
    const utils = state._internal;

    const err = utils._errorUtils._value;

    const isError = err !== undefined;

    if (isError && !safeReturn) {
      throw err;
    }

    if (utils._value !== undefined || isError) {
      const value = useHandleSuspenseValue(
        state,
        errorBoundaryCtx,
        suspenseCtx,
        useForceRerender()
      );

      return safeReturn ? [value, err] : value;
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
      ? T
      : Readonly<[value: T, error: undefined] | [value: undefined, error: E]>
    : undefined;
};

export default use;
