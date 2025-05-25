import type { ContextType } from 'react';
import type { InternalAsyncState } from '../types';
import type ErrorBoundaryContext from './ErrorBoundaryContext';
import type SuspenseContext from './SuspenseContext';
import type { SkeletonState } from '../SKELETON_STATE';
import getPromise from '../getPromise';
import load from '../load';

const handleSuspense = (
  state: InternalAsyncState | SkeletonState,
  errorBoundaryCtx: ContextType<typeof ErrorBoundaryContext>,
  suspenseCtx: ContextType<typeof SuspenseContext>
) => {
  if ('_fakeSuspense' in state) {
    return state._fakeSuspense(suspenseCtx, errorBoundaryCtx);
  }

  if (state._load) {
    if (!suspenseCtx) {
      throw new Error('No Suspense Wrapper');
    }

    if (!suspenseCtx.has(state)) {
      const unload = load(state);

      suspenseCtx.set(state, unload);

      if (errorBoundaryCtx) {
        errorBoundaryCtx.add(unload);
      }
    }
  }

  return getPromise(state as any);
};

export default handleSuspense;
