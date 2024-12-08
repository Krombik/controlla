import noop from 'lodash.noop';
import type { AsyncStateProperties, LoadableState } from '../types';
import alwaysFalse from '../utils/alwaysFalse';
import { ContextType } from 'react';
import type SuspenseContext from '../utils/SuspenseContext';
import type ErrorBoundaryContext from '../utils/ErrorBoundaryContext';

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

const alwaysNoop = () => noop;

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
  _withoutLoading: true,
  _internal: {
    _promise: {
      _promise: Object.create(Promise.prototype, {
        then: NOOP_PROMISE_DESCRIPTOR,
        catch: NOOP_PROMISE_DESCRIPTOR,
        finally: NOOP_PROMISE_DESCRIPTOR,
      }),
    } as AsyncStateProperties['_promise'],
    _slowLoading: {
      _callbackSet: { add: noop, delete: noop },
    } as AsyncStateProperties['_slowLoading'],
  } as Partial<AsyncStateProperties>,
  load: alwaysNoop,
  control: new Proxy(
    {},
    {
      get: alwaysNoop,
    }
  ),
  _onValueChange: noop,
  get: noop,
  set: noop,
  error: {
    get: noop,
    set: noop,
    _onValueChange: alwaysNoop,
    _value: undefined,
  } as Partial<LoadableState['error']> as LoadableState['error'],
  isLoaded: {
    get: alwaysFalse,
    _set: noop,
    _onValueChange: alwaysNoop,
    _value: false,
  } as Partial<LoadableState['isLoaded']> as LoadableState['isLoaded'],
} as Partial<SkeletonState> as SkeletonState;

export default SKELETON_STATE;
