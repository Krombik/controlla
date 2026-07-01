import noop from 'lodash.noop';
import type {
  PendingControl,
  Mutable,
  AsyncControlInternals,
  ErrorControlInternals,
} from '#internal/types';
import { INTERNALS } from '#internal/constants';
import type { AsyncControlScope } from '#types';
import alwaysTrue from '#internal/alwaysTrue';

function alwaysThis(this: any) {
  return this;
}

const NOOP_PROMISE_DESCRIPTOR: PropertyDescriptor = {
  value: alwaysThis,
};

const errorControl = {
  _root: undefined!,
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
  _root: undefined!,
  _errorControl: {
    [INTERNALS]: errorControl,
  },
  _loadingControl: undefined!,
  _readyControl: undefined!,
} as Partial<PendingControl> as PendingControl;

(internals as Mutable<typeof internals>)._root = internals;

(errorControl as Mutable<typeof errorControl>)._root = errorControl;

(internals as Mutable<typeof internals>)._loadingControl = {
  [INTERNALS]: {
    _root: internals,
    _get: alwaysTrue,
    _value: true,
  } as Partial<AsyncControlInternals['_loadingControl'][typeof INTERNALS]>,
} as AsyncControlInternals['_loadingControl'];

(internals as Mutable<typeof internals>)._readyControl = {
  [INTERNALS]: {
    _root: internals,
    _get: noop,
    _value: undefined,
  } as Partial<AsyncControlInternals['_readyControl'][typeof INTERNALS]>,
} as AsyncControlInternals['_readyControl'];

/**
 * An async control that is permanently loading: the value is always
 * `undefined`, `loading` is always `true`, its promise never settles and it
 * suspends indefinitely. Writes and `invalidate` are no-ops. Use it as a
 * placeholder where a control is expected but the real one isn't available
 * yet — nested paths of it are pending too.
 *
 * @example
 * ```jsx
 * const Card = ({ $user }) => (
 *   <SuspenseControlConsumer
 *     control={$user || $pending}
 *     fallback="Loading..." // shown forever while $user is absent
 *     render={(user) => <Content user={user} />}
 *   />
 * );
 * ```
 */
const $pending: AsyncControlScope = new Proxy(internals, {
  get(target, key, proxy) {
    return key === INTERNALS ? target : proxy;
  },
}) as any;

export default $pending;
