import { ContextType } from 'react';
import { AnyAsyncState, AsyncState } from '../types';
import ErrorBoundaryContext from './ErrorBoundaryContext';
import SuspenseContext from './SuspenseContext';
import getPromise from '../getPromise';

export const handleLoad = (
  state: AnyAsyncState,
  errorBoundaryCtx: ContextType<typeof ErrorBoundaryContext>,
  suspenseCtx: ContextType<typeof SuspenseContext>
) => {
  if ('load' in state && !state._withoutLoading) {
    const utils = state._internal;

    if (!errorBoundaryCtx.has(utils)) {
      let unload: () => void;

      if (suspenseCtx) {
        if (suspenseCtx.has(utils)) {
          unload = suspenseCtx.get(utils)!;
        } else {
          unload = state.load();

          suspenseCtx.set(utils, unload);
        }
      } else {
        unload = state.load();
      }

      errorBoundaryCtx.set(utils, unload);
    } else if (suspenseCtx && !suspenseCtx.has(utils)) {
      suspenseCtx.set(utils, errorBoundaryCtx.get(utils)!);
    }
  }

  return getPromise(state, true);
};

export const handleUnload = (
  utils: AsyncState['_internal'],
  errorBoundaryCtx: ContextType<typeof ErrorBoundaryContext>,
  suspenseCtx: ContextType<typeof SuspenseContext>
) => {
  let unload: (() => void) | undefined;

  if (errorBoundaryCtx.has(utils)) {
    unload = errorBoundaryCtx.get(utils)!;

    errorBoundaryCtx.delete(utils);

    if (suspenseCtx) {
      suspenseCtx.delete(utils);
    }
  } else if (suspenseCtx && suspenseCtx.has(utils)) {
    unload = suspenseCtx.get(utils)!;

    suspenseCtx.delete(utils);
  }

  return unload;
};
