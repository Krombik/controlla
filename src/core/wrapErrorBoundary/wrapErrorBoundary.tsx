import type { Component, ContextType } from 'react';
import ErrorBoundaryContext from '#internal/ErrorBoundaryContext';
import type SuspenseContext from '#internal/SuspenseContext';

const CTX = Symbol();

/**
 * Wraps a class error boundary so that, when it catches an error, the
 * loadings started by components suspended beneath it are released. A
 * component that threw never commits, so React can't clean those loadings up
 * without the wrapper.
 *
 * Use it on any error boundary that may catch errors from this library's
 * suspense hooks or components.
 *
 * @example
 * ```tsx
 * class ErrorBoundary extends React.Component { ... }
 *
 * export default wrapErrorBoundary(ErrorBoundary);
 * ```
 */
const wrapErrorBoundary = <T extends typeof Component>(Component: T): T =>
  //@ts-expect-error
  class extends Component {
    readonly [CTX]: NonNullable<ContextType<typeof ErrorBoundaryContext>> =
      new Set();

    componentDidCatch(error: any, errorInfo: any) {
      const ctx = this[CTX];

      const it = ctx.values();

      for (let i = ctx.size; i--;) {
        const items: NonNullable<ContextType<typeof SuspenseContext>> =
          it.next().value!;

        for (let i = 0; i < items.length; i++) {
          items[i]._detach(undefined, undefined, true);
        }

        items.length = 0;
      }

      ctx.clear();

      super.componentDidCatch?.(error, errorInfo);
    }

    render() {
      return (
        <ErrorBoundaryContext.Provider value={this[CTX]}>
          {super.render()}
        </ErrorBoundaryContext.Provider>
      );
    }
  };

export default wrapErrorBoundary;
