import noop from 'lodash.noop';
import type { SkeletonControl, Mutable, AsyncControlRoot } from '#_types';
import alwaysFalse from '#shared/alwaysFalse';
import alwaysNoop from '#shared/alwaysNoop';
import { ROOT } from '#shared/constants';
import type { LoadableControl } from '#types';

const NOOP_PROMISE_DESCRIPTOR: PropertyDescriptor = {
  value() {
    return this;
  },
};

const utils = {
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
  _promise: Object.create(Promise.prototype, {
    then: NOOP_PROMISE_DESCRIPTOR,
    catch: NOOP_PROMISE_DESCRIPTOR,
    finally: NOOP_PROMISE_DESCRIPTOR,
  }),
  _slowLoading: null,
  _value: undefined,
  _subscribe: alwaysNoop,
  _get: noop,
  _enqueueSet: noop,
  _root: undefined!,
  _errorControl: {
    [ROOT]: {
      _get: noop,
      _enqueueSet: noop,
      _subscribe: alwaysNoop,
      _value: undefined,
      _valueToggler: true,
    } as Partial<AsyncControlRoot['_errorControl'][typeof ROOT]>,
  } as AsyncControlRoot['_errorControl'],
  _isLoadedControl: {
    [ROOT]: {
      _get: alwaysFalse,
      _set: noop,
      _subscribe: alwaysNoop,
      _value: false,
      _valueToggler: true,
    },
  },
  _valueToggler: true,
} as Partial<SkeletonControl> as SkeletonControl;

(utils as Mutable<typeof utils>)._root = utils;

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
