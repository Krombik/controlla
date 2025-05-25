import noop from 'lodash.noop';
import type {
  InternalAsyncState,
  InternalState,
  LoadableState,
  Mutable,
} from '../types';
import alwaysFalse from '../utils/alwaysFalse';
import type { ContextType } from 'react';
import type SuspenseContext from '../utils/SuspenseContext';
import type ErrorBoundaryContext from '../utils/ErrorBoundaryContext';
import alwaysNoop from '../utils/alwaysNoop';
import { ROOT } from '../utils/constants';

export type SkeletonState = {
  _fakeSuspense(
    suspenseCtx: ContextType<typeof SuspenseContext>,
    errorBoundaryCtx: ContextType<typeof ErrorBoundaryContext>
  ): Promise<any>;
} & InternalAsyncState;

const NOOP_PROMISE_DESCRIPTOR: PropertyDescriptor = {
  value() {
    return this;
  },
};

const utils = {
  _fakeSuspense(suspenseCtx, errorBoundaryCtx) {
    if (suspenseCtx) {
      return new Promise<void>((res) => {
        suspenseCtx.set({} as any, res);

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
  } as InternalAsyncState['_promise'],
  _slowLoading: {
    _callbacks: { add: noop, delete: noop },
  } as InternalAsyncState['_slowLoading'],
  _value: undefined,
  _onValueChange: alwaysNoop,
  _get: noop,
  _set: noop,
  [ROOT]: undefined!,
  _errorState: {
    [ROOT]: {
      _get: noop,
      _set: noop,
      _onValueChange: alwaysNoop,
      _value: undefined,
      _valueToggler: 0,
    } as Partial<InternalAsyncState[typeof ROOT]['_errorState'][typeof ROOT]>,
  },
  _isLoadedState: {
    [ROOT]: {
      _get: alwaysFalse,
      _set: noop,
      _onValueChange: alwaysNoop,
      _value: false,
      _valueToggler: 0,
    } as Partial<InternalState>,
  },
  _subscribeWithError: alwaysNoop,
  _valueToggler: 0,
} as Partial<SkeletonState> as SkeletonState;

(utils as Mutable<typeof utils>)[ROOT] = utils;

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
const SKELETON_STATE: LoadableState<any, any, any> = new Proxy(utils, {
  get(target, key, proxy) {
    return key == ROOT ? target : proxy;
  },
}) as any;

export default SKELETON_STATE;
