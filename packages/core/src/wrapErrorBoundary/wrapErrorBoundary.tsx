import type { Component, ContextType } from 'react';
import ErrorBoundaryContext from '#internal/ErrorBoundaryContext';
import noop from 'lodash.noop';
import type SuspenseContext from '#internal/SuspenseContext';

const ORIGINAL_RENDER = Symbol();

const ORIGINAL_DID_CATCH = Symbol();

const CTX = Symbol();

/** A higher-order function that wraps a React class component with additional error boundary handling. */
const wrapErrorBoundary = <T extends typeof Component>(Component: T): T => {
  const { render, componentDidCatch } = Component.prototype;

  //@ts-expect-error
  return class extends Component {
    readonly [CTX]: NonNullable<ContextType<typeof ErrorBoundaryContext>> =
      new Set();

    readonly [ORIGINAL_RENDER] = render;

    readonly [ORIGINAL_DID_CATCH] = componentDidCatch || noop;

    componentDidCatch(error: any, errorInfo: any) {
      const ctx = this[CTX];

      const it = ctx.values();

      for (let i = ctx.size; i--; ) {
        const items: NonNullable<ContextType<typeof SuspenseContext>> =
          it.next().value!;

        for (let i = 0; i < items.length; i--) {
          items[i]._detach(undefined, undefined, true);
        }

        items.length = 0;
      }

      ctx.clear();

      this[ORIGINAL_DID_CATCH](error, errorInfo);
    }

    render() {
      return (
        <ErrorBoundaryContext.Provider value={this[CTX]}>
          {this[ORIGINAL_RENDER]()}
        </ErrorBoundaryContext.Provider>
      );
    }
  };
};

export default wrapErrorBoundary;
