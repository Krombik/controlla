import type { ContextType } from 'react';
import type { AnyAsyncState, LoadableState } from '../types';
import type ErrorBoundaryContext from './ErrorBoundaryContext';
import type SuspenseContext from './SuspenseContext';
import getPromise from '../getPromise';
import type { SkeletonState } from '../SKELETON_STATE';

const handleSuspense = (
  state: AnyAsyncState | SkeletonState,
  errorBoundaryCtx: ContextType<typeof ErrorBoundaryContext>,
  suspenseCtx: ContextType<typeof SuspenseContext>
) => {
  if ('_fakeSuspense' in state) {
    return state._fakeSuspense(suspenseCtx, errorBoundaryCtx);
  }

  if ((state as LoadableState).load) {
    if (!suspenseCtx) {
      throw new Error('No Suspense Wrapper');
    }

    if (!suspenseCtx.has(state)) {
      const unload = (state as LoadableState).load();

      suspenseCtx.set(state, unload);

      if (errorBoundaryCtx) {
        errorBoundaryCtx.add(unload);
      }
    }
  }

  return getPromise(state);
};

export default handleSuspense;
