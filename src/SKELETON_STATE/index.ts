import noop from 'lodash.noop';
import type {
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

/**
 * A special state that remains permanently in a pending state.
 * This state never resolves, its {@link SkeletonState.isLoaded isLoaded} is always `false`, and it triggers Suspense indefinitely.
 * It supports all state methods, such as {@link SkeletonState.load load} or {@link SkeletonState.loading pause},
 * although these methods are implemented as no-ops.
 *
 * @example
 * ```jsx
 * const Card = ({ asyncState }) => (
 *    <SuspenseController
 *      state={asyncState || SKELETON_STATE}
 *      fallback='Loading...' // if no asyncState was provided fallback always be shown
 *      render={(value) => <Content value={value} />}
 *    />
 * );
 * ```
 */
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
    _slowLoading: {
      _callbackSet: { add: noop, delete: noop },
    } as AsyncStateUtils['_slowLoading'],
  } as Partial<AsyncStateUtils>,
  scope() {
    return new Proxy(this, {
      get(target, prop, proxy) {
        return prop != $tate ? proxy : target;
      },
    });
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
