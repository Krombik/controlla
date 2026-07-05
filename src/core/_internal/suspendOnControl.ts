import type { ContextType } from 'react';
import type { AsyncControlInternals, PendingControl } from '#internal/types';
import type ErrorBoundaryContext from '#internal/ErrorBoundaryContext';
import type SuspenseContext from '#internal/SuspenseContext';
import selectPromise from '#internal/selectPromise';

const suspendOnControl = (
  root: AsyncControlInternals | PendingControl,
  errorBoundaryCtx: ContextType<typeof ErrorBoundaryContext>,
  suspenseCtx: ContextType<typeof SuspenseContext>
) => {
  if (root._load || '_fakeSuspense' in root) {
    if (!suspenseCtx) {
      throw new Error('No Suspense Wrapper');
    }

    if (errorBoundaryCtx) {
      errorBoundaryCtx.add(suspenseCtx);
    }

    if (root._load) {
      root._attach(undefined, undefined, true);

      suspenseCtx.push(root);
    } else {
      return (root as PendingControl)._fakeSuspense(suspenseCtx);
    }
  }

  return selectPromise(root);
};

export default suspendOnControl;
