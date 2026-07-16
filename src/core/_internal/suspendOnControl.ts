import type { ContextType } from 'react';
import type { AsyncControlInternals, NeverControl } from '#internal/types';
import type ErrorBoundaryContext from '#internal/ErrorBoundaryContext';
import type SuspenseContext from '#internal/SuspenseContext';
import ensurePromise from '#internal/ensurePromise';

const suspendOnControl = (
  root: AsyncControlInternals | NeverControl,
  errorBoundaryCtx: ContextType<typeof ErrorBoundaryContext>,
  suspenseCtx: ContextType<typeof SuspenseContext>
) => {
  if (root._load || '_fakeSuspense' in root) {
    if (!suspenseCtx) {
      throw new Error('no Suspense boundary');
    }

    if (errorBoundaryCtx) {
      errorBoundaryCtx.add(suspenseCtx);
    }

    if (root._load) {
      root._attach(undefined, undefined, true);

      suspenseCtx.push(root);
    } else {
      return (root as NeverControl)._fakeSuspense(suspenseCtx);
    }
  }

  return ensurePromise(root);
};

export default suspendOnControl;
