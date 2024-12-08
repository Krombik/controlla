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

  if (state._load && !state._withoutLoading) {
    if (suspenseCtx) {
      const unload = (state as LoadableState).load();

      suspenseCtx.push(unload);

      if (errorBoundaryCtx) {
        errorBoundaryCtx.add(unload);
      }
    } else {
      throw new Error('No Suspense Wrapper');
    }
  }

  return getPromise(state, true);
};

export default handleSuspense;
