import type { ContextType } from 'react';
import type { AsyncControlRoot, SkeletonControl } from '#_types';
import type ErrorBoundaryContext from '#utils/ErrorBoundaryContext';
import type SuspenseContext from '#utils/SuspenseContext';
import alwaysNoop from '#shared/alwaysNoop';

const handleSuspense = (
  control: AsyncControlRoot | SkeletonControl,
  errorBoundaryCtx: ContextType<typeof ErrorBoundaryContext>,
  suspenseCtx: ContextType<typeof SuspenseContext>
) => {
  if ('_fakeSuspense' in control) {
    return control._fakeSuspense(suspenseCtx, errorBoundaryCtx);
  }

  if (control._load != alwaysNoop) {
    if (!suspenseCtx) {
      throw new Error('No Suspense Wrapper');
    }

    const unload = control._load();

    suspenseCtx.push(unload);

    if (errorBoundaryCtx) {
      errorBoundaryCtx.add(unload);
    }
  }

  return control._promise;
};

export default handleSuspense;
