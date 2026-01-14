import noop from 'lodash.noop';
import type { InternalAsyncControl, InternalControl, Mutable } from '#_types';
import alwaysFalse from '#shared/alwaysFalse';
import type { ContextType } from 'react';
import type SuspenseContext from '#utils/SuspenseContext';
import type ErrorBoundaryContext from '#utils/ErrorBoundaryContext';
import alwaysNoop from '#shared/alwaysNoop';
import { ROOT } from '#shared/constants';
import type { LoadableControl } from '#types';

/** @internal */
export type SkeletonControl = {
  _fakeSuspense(
    suspenseCtx: ContextType<typeof SuspenseContext>,
    errorBoundaryCtx: ContextType<typeof ErrorBoundaryContext>
  ): Promise<any>;
} & InternalAsyncControl;

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
  } as InternalAsyncControl['_promise'],
  _slowLoading: {
    _callbacks: { add: noop, delete: noop },
  } as InternalAsyncControl['_slowLoading'],
  _value: undefined,
  _subscribe: alwaysNoop,
  _get: noop,
  _set: noop,
  [ROOT]: undefined!,
  _errorControl: {
    [ROOT]: {
      _get: noop,
      _set: noop,
      _subscribe: alwaysNoop,
      _value: undefined,
      _valueToggler: true,
    } as Partial<
      InternalAsyncControl[typeof ROOT]['_errorControl'][typeof ROOT]
    >,
  } as Partial<InternalAsyncControl[typeof ROOT]['_errorControl']>,
  _isLoadedControl: {
    [ROOT]: {
      _get: alwaysFalse,
      _set: noop,
      _subscribe: alwaysNoop,
      _value: false,
      _valueToggler: true,
    } as Partial<InternalControl>,
  } as Partial<InternalAsyncControl[typeof ROOT]['_isLoadedControl']>,
  _subscribeWithError: alwaysNoop,
  _valueToggler: true,
} as Partial<SkeletonControl> as SkeletonControl;

(utils as Mutable<typeof utils>)[ROOT] = utils;

/**
 * A special control that remains permanently in a pending control.
 * This control never resolves, its {@link SkeletonControl.isLoaded isLoaded} is always `false`, and it triggers Suspense indefinitely.
 *
 * @example
 * ```jsx
 * const Card = ({ asyncControl }) => (
 *    <SuspenseController
 *      control={asyncControl || SKELETON_CONTROL}
 *      fallback='Loading...' // if no asyncControl was provided fallback always be shown
 *      render={(value) => <Content value={value} />}
 *    />
 * );
 * ```
 */
const SKELETON_CONTROL: LoadableControl<any, any, any> = new Proxy(utils, {
  get(target, key, proxy) {
    return key === ROOT ? target : proxy;
  },
}) as any;

export default SKELETON_CONTROL;
