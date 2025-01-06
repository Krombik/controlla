import noop from 'lodash.noop';
import type { LoadableState, Mutable } from '../types';
import alwaysFalse from '../utils/alwaysFalse';
import type { ContextType } from 'react';
import type SuspenseContext from '../utils/SuspenseContext';
import type ErrorBoundaryContext from '../utils/ErrorBoundaryContext';
import alwaysNoop from '../utils/alwaysNoop';

export type SkeletonState = {
  /** @internal */
  _fakeSuspense(
    suspenseCtx: ContextType<typeof SuspenseContext>,
    errorBoundaryCtx: ContextType<typeof ErrorBoundaryContext>
  ): Promise<any>;
} & LoadableState<any, any, any>;

const NOOP_PROMISE_DESCRIPTOR: PropertyDescriptor = {
  value() {
    return this;
  },
};

/**
 * A special state that remains permanently in a pending state.
 * This state never resolves, its {@link SkeletonState.isLoaded isLoaded} is always `false`, and it triggers Suspense indefinitely.
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
  _promise: {
    _promise: Object.create(Promise.prototype, {
      then: NOOP_PROMISE_DESCRIPTOR,
      catch: NOOP_PROMISE_DESCRIPTOR,
      finally: NOOP_PROMISE_DESCRIPTOR,
    }),
  } as LoadableState['_promise'],
  _slowLoading: {
    _callbacks: { add: noop, delete: noop },
  } as LoadableState['_slowLoading'],
  _value: undefined,
  load: alwaysNoop,
  control: new Proxy(
    {},
    {
      get(_, __, proxy) {
        return proxy;
      },
      has: alwaysFalse,
    }
  ),
  _onValueChange: alwaysNoop,
  get: noop,
  set: noop,
  _root: undefined!,
  error: {
    get: noop,
    set: noop,
    _onValueChange: alwaysNoop,
    _value: undefined,
  } as Partial<LoadableState['error']> as LoadableState['error'],
  isLoaded: {
    get: alwaysFalse,
    set: noop,
    _onValueChange: alwaysNoop,
    _value: false,
  } as Partial<LoadableState['isLoaded']> as LoadableState['isLoaded'],
  _subscribeWithError: alwaysNoop,
} as Partial<SkeletonState> as SkeletonState;

(SKELETON_STATE as Mutable<typeof SKELETON_STATE>)._root = SKELETON_STATE;

export default SKELETON_STATE;
