import noop from '#internal/noop';
import type {
  Mutable,
  AsyncControlInternals,
  ErrorControlInternals,
  Notifier,
} from '#internal/types';
import { INTERNALS, EMPTY_ARR } from '#internal/constants';
import type { AsyncControlScope } from '#types';
import alwaysTrue from '#internal/alwaysTrue';

// $never never emits, so a derived control attaching to it must register
// nothing: this sink swallows push/pop, leaving $never's _dependents untouched
const inertDependents = {
  push: noop,
  pop: noop,
  length: 0,
} as unknown as Notifier[];

const NOOP_PROMISE_DESCRIPTOR: PropertyDescriptor = {
  value(this: any) {
    return this;
  },
};

const errorControl = {
  _root: undefined!,
  _get: noop,
  _enqueueSet: noop,
  _value: undefined,
  _attach: noop,
  _detach: noop,
  _listeners: EMPTY_ARR,
  _dependents: inertDependents,
} as Partial<
  ErrorControlInternals<AsyncControlInternals>
> as ErrorControlInternals<AsyncControlInternals>;

const NOOP_PROMISE_DESCRIPTORS: PropertyDescriptorMap = {
  then: NOOP_PROMISE_DESCRIPTOR,
  catch: NOOP_PROMISE_DESCRIPTOR,
  finally: NOOP_PROMISE_DESCRIPTOR,
};

const internals = {
  _promise: {
    // fresh every read: React keeps its own bookkeeping on a thrown thenable,
    // and two suspensions must not share it
    get _promise() {
      return Object.create(Promise.prototype, NOOP_PROMISE_DESCRIPTORS);
    },
  } as AsyncControlInternals['_promise'],
  _attach: noop,
  _detach: noop,
  _value: undefined,
  _get: noop,
  _enqueueSet: noop,
  _root: undefined!,
  _listeners: EMPTY_ARR,
  _dependents: inertDependents,
  _errorControl: {
    [INTERNALS]: errorControl,
  },
  _loadingControl: undefined!,
  _readyControl: undefined!,
} as Partial<AsyncControlInternals> as AsyncControlInternals;

(internals as Mutable<typeof internals>)._root = internals;

(errorControl as Mutable<typeof errorControl>)._root = errorControl;

(internals as Mutable<typeof internals>)._loadingControl = {
  [INTERNALS]: {
    _root: internals,
    _get: alwaysTrue,
    _value: true,
    _listeners: EMPTY_ARR,
    _dependents: inertDependents,
  } as Partial<AsyncControlInternals['_loadingControl'][typeof INTERNALS]>,
} as AsyncControlInternals['_loadingControl'];

(internals as Mutable<typeof internals>)._readyControl = {
  [INTERNALS]: {
    _root: internals,
    _get: noop,
    _value: undefined,
    _listeners: EMPTY_ARR,
    _dependents: inertDependents,
  } as Partial<AsyncControlInternals['_readyControl'][typeof INTERNALS]>,
} as AsyncControlInternals['_readyControl'];

/**
 * An async control that is permanently loading: the value is always
 * `undefined`, `loading` is always `true`, its promise never settles and it
 * suspends indefinitely. Writes and `invalidate` are no-ops. Use it as a
 * placeholder where a control is expected but the real one isn't available
 * yet - nested paths of it never settle either.
 *
 * @example
 * ```jsx
 * const Card = ({ $user }) => (
 *   <SuspenseControlConsumer
 *     control={$user || $never}
 *     fallback="Loading..." // shown forever while $user is absent
 *     render={(user) => <h2>{user.name}</h2>}
 *   />
 * );
 * ```
 */
const $never: AsyncControlScope = new Proxy(internals, {
  get(target, key, proxy) {
    return key === INTERNALS ? target : proxy;
  },
}) as any;

export default $never;
