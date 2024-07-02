import { Component, type ContextType } from 'react';
import UseContext from '../utils/UseContext';

const ORIGINAL_RENDER = Symbol();

const ORIGINAL_DID_CATCH = Symbol();

const CTX = Symbol();

const withUseHandler = (component: typeof Component) => {
  const { render, componentDidCatch } = component.prototype;

  return class extends component {
    readonly [CTX]: ContextType<typeof UseContext> = new Map();

    readonly [ORIGINAL_RENDER] = render;

    readonly [ORIGINAL_DID_CATCH] = componentDidCatch;

    componentDidCatch(error: any, errorInfo: any) {
      const ctx = this[CTX];

      const it = ctx.values();

      for (let i = ctx.size; i--; ) {
        it.next().value();
      }

      ctx.clear();

      if (this[ORIGINAL_DID_CATCH]) {
        this[ORIGINAL_DID_CATCH](error, errorInfo);
      }
    }

    render() {
      return (
        <UseContext.Provider value={this[CTX]}>
          {this[ORIGINAL_RENDER]()}
        </UseContext.Provider>
      );
    }
  };
};

export default withUseHandler;
