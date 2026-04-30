import noop from 'lodash.noop';
import type {
  PendingControl,
  Mutable,
  AsyncControlInternals,
  ErrorControlInternals,
} from '#internal/types';
import { INTERNALS } from '#shared-internal/constants';
import type { AsyncControlScope } from '#types';
import alwaysTrue from '#shared-internal/alwaysTrue';

function alwaysThis(this: any) {
  return this;
}

const NOOP_PROMISE_DESCRIPTOR: PropertyDescriptor = {
  value: alwaysThis,
};

const errorControl = {
  [INTERNALS]: undefined!,
  _get: noop,
  _enqueueSet: noop,
  _value: undefined,
  _attach: noop,
  _detach: noop,
} as Partial<
  ErrorControlInternals<AsyncControlInternals>
> as ErrorControlInternals<AsyncControlInternals>;

const internals = {
  _fakeSuspense(suspenseCtx) {
    return new Promise<any>((res) => {
      suspenseCtx.push({ _detach: res });
    });
  },
  _promise: {
    _promise: Object.create(Promise.prototype, {
      then: NOOP_PROMISE_DESCRIPTOR,
      catch: NOOP_PROMISE_DESCRIPTOR,
      finally: NOOP_PROMISE_DESCRIPTOR,
    }),
  } as AsyncControlInternals['_promise'],
  _attach: noop,
  _detach: noop,
  _value: undefined,
  _get: noop,
  _enqueueSet: noop,
  [INTERNALS]: undefined!,
  _errorControl: {
    [INTERNALS]: errorControl,
  },
  _loadingControl: undefined!,
  _readyControl: undefined!,
} as Partial<PendingControl> as PendingControl;

(internals as Mutable<typeof internals>)[INTERNALS] = internals;

(errorControl as Mutable<typeof errorControl>)[INTERNALS] = errorControl;

(internals as Mutable<typeof internals>)._loadingControl = {
  [INTERNALS]: {
    [INTERNALS]: internals,
    _get: alwaysTrue,
    _value: true,
  } as Partial<AsyncControlInternals['_loadingControl'][typeof INTERNALS]>,
} as AsyncControlInternals['_loadingControl'];

(internals as Mutable<typeof internals>)._readyControl = {
  [INTERNALS]: {
    [INTERNALS]: internals,
    _get: noop,
    _value: undefined,
  } as Partial<AsyncControlInternals['_readyControl'][typeof INTERNALS]>,
} as AsyncControlInternals['_readyControl'];

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
const PENDING_CONTROL: AsyncControlScope = new Proxy(internals, {
  get(target, key, proxy) {
    return key === INTERNALS ? target : proxy;
  },
}) as any;

export default PENDING_CONTROL;
