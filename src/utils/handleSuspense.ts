import type { ContextType } from 'react';
import type { InternalAsyncControl } from '../types';
import type ErrorBoundaryContext from './ErrorBoundaryContext';
import type SuspenseContext from './SuspenseContext';
import type { SkeletonControl } from '../SKELETON_CONTROL';
import getPromise from '../getPromise';
import load from '../load';

const handleSuspense = (
  control: InternalAsyncControl | SkeletonControl,
  errorBoundaryCtx: ContextType<typeof ErrorBoundaryContext>,
  suspenseCtx: ContextType<typeof SuspenseContext>
) => {
  if ('_fakeSuspense' in control) {
    return control._fakeSuspense(suspenseCtx, errorBoundaryCtx);
  }

  if (control._load) {
    if (!suspenseCtx) {
      throw new Error('No Suspense Wrapper');
    }

    if (!suspenseCtx.has(control)) {
      const unload = load(control);

      suspenseCtx.set(control, unload);

      if (errorBoundaryCtx) {
        errorBoundaryCtx.add(unload);
      }
    }
  }

  return getPromise(control as any);
};

export default handleSuspense;
