import type { ContextType } from 'react';
import type { AsyncRootNode, PendingControl } from '#internal/types';
import type ErrorBoundaryContext from '#internal/ErrorBoundaryContext';
import type SuspenseContext from '#internal/SuspenseContext';
import alwaysNoop from '#shared-internal/alwaysNoop';

const suspendOnControl = (
  root: AsyncRootNode | PendingControl,
  errorBoundaryCtx: ContextType<typeof ErrorBoundaryContext>,
  suspenseCtx: ContextType<typeof SuspenseContext>
) => {
  if ('_fakeSuspense' in root) {
    return root._fakeSuspense(suspenseCtx, errorBoundaryCtx);
  }

  if (root._attachLoad != alwaysNoop) {
    if (!suspenseCtx) {
      throw new Error('No Suspense Wrapper');
    }

    const unload = root._attachLoad();

    suspenseCtx.push(unload);

    if (errorBoundaryCtx) {
      errorBoundaryCtx.add(unload);
    }
  }

  return root._loadPromise;
};

export default suspendOnControl;
