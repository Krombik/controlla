import noop from 'lodash.noop';
import type {
  PendingControl,
  Mutable,
  AsyncRootNode,
  ErrorControlInternals,
} from '#internal/types';
import alwaysNoop from '#shared-internal/alwaysNoop';
import { INTERNALS } from '#shared-internal/constants';
import type { LoadableControlScope } from '#types';
import alwaysTrue from '#shared-internal/alwaysTrue';

const NOOP_PROMISE_DESCRIPTOR: PropertyDescriptor = {
  value() {
    return this;
  },
};

const errorControl = {
  _root: undefined!,
  _get: noop,
  _enqueueSet: noop,
  _subscribe: alwaysNoop,
  _value: undefined,
  _version: true,
} as Partial<ErrorControlInternals> as ErrorControlInternals;

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
  _slowLoadMonitor: null,
  _value: undefined,
  _subscribe: alwaysNoop,
  _get: noop,
  _enqueueSet: noop,
  _root: undefined!,
  _errorControl: {
    [INTERNALS]: errorControl,
  },
  _loadingControl: {
    [INTERNALS]: {
      _get: alwaysTrue,
      _subscribe: alwaysNoop,
      _valueToggler: true,
    } as Partial<AsyncRootNode['_loadingControl'][typeof INTERNALS]>,
  },
  _readyControl: undefined!,
  _version: true,
} as Partial<PendingControl> as PendingControl;

(utils as Mutable<typeof utils>)._root = utils;

(errorControl as Mutable<typeof errorControl>)._root = errorControl;

(utils as Mutable<typeof utils>)._readyControl = {
  [INTERNALS]: {
    _get: noop,
    _root: utils,
    _subscribe: alwaysNoop,
    _version: undefined!,
  } as Partial<AsyncRootNode['_readyControl'][typeof INTERNALS]>,
} as AsyncRootNode['_readyControl'];

/**
 * A special control that remains permanently in a pending state.
 * This control never resolves, its loading is always `true`, ready is always `undefined`, and it triggers Suspense indefinitely.
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
const PENDING_CONTROL: LoadableControlScope<any, any, any> = new Proxy(utils, {
  get(target, key, proxy) {
    return key === INTERNALS ? target : proxy;
  },
}) as any;

export default PENDING_CONTROL;
