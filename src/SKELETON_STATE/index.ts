import noop from 'lodash.noop';
import {
  AsyncStateUtils,
  ControllableLoadableNestedState,
  StateInternalUtils,
  StateScope,
} from '../types';
import alwaysFalse from '../utils/alwaysFalse';
import { $tate } from '../utils/constants';
import { ContextType } from 'react';
import type SuspenseContext from '../utils/SuspenseContext';
import type ErrorBoundaryContext from '../utils/ErrorBoundaryContext';

type Scope = StateScope<() => any>;

export type SkeletonState = {
  /** @internal */
  _fakeSuspense(
    suspenseCtx: ContextType<typeof SuspenseContext>,
    errorBoundaryCtx: ContextType<typeof ErrorBoundaryContext>
  ): Promise<any>;
} & Omit<ControllableLoadableNestedState<any, any, any[]>, keyof Scope> &
  Scope;

function selfReturn<T>(this: T) {
  return this;
}

const alwaysNoop = () => noop;

const errorUtils: Partial<StateInternalUtils> = {
  _get: noop,
  _set: noop,
  _onValueChange: alwaysNoop,
};

const SKELETON_STATE = {
  _fakeSuspense(suspenseCtx, errorBoundaryCtx) {
    if (suspenseCtx) {
      return new Promise<void>((res) => {
        suspenseCtx.push(res);

        if (errorBoundaryCtx) {
          errorBoundaryCtx.add(res);
        }
      });
    }

    throw new Error('No Suspense Wrapper');
  },
  _withoutLoading: true,
  _internal: {
    _promise: {
      _promise: Object.setPrototypeOf(
        {
          then: selfReturn,
          catch: selfReturn,
          finally: selfReturn,
        } as Promise<any>,
        Promise.prototype
      ),
    } as AsyncStateUtils['_promise'],
    _errorUtils: errorUtils as any,
    _get: noop,
    _set: noop,
    _onValueChange: alwaysNoop,
  } as Partial<AsyncStateUtils>,
  scope() {
    const self = this;

    const proxy = new Proxy(
      {},
      {
        get(_, prop) {
          return prop != $tate ? proxy : self;
        },
      }
    );

    return proxy;
  },
  load: alwaysNoop,
  loading: { pause: noop, reset: noop, resume: noop },
  error: {
    _internal: errorUtils,
  } as Partial<
    ControllableLoadableNestedState['error']
  > as ControllableLoadableNestedState['error'],
  isLoaded: {
    _internal: {
      _value: false,
      _get: alwaysFalse,
      _set: noop,
      _onValueChange: alwaysNoop,
    },
  } as Partial<
    ControllableLoadableNestedState['isLoaded']
  > as ControllableLoadableNestedState['isLoaded'],
} as Partial<SkeletonState> as SkeletonState;

export default SKELETON_STATE;
