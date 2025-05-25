import type {
  InternalAsyncState,
  InternalState,
  Mutable,
  ValueChangeCallbacks,
} from '../types';
import concat from './concat';
import { ROOT } from './constants';
import {
  createLoadableSubscribe,
  createSubscribeWithError,
} from './createAsyncSubscribe';
import createSubscribe from './createSubscribe';

function get(this: InternalState) {
  const path = this._path!;

  const l = path.length;

  let value = this[ROOT]!._value;

  for (
    let i = 0;
    i < l && (value = value ? value[path[i]] : undefined) !== undefined;
    i++
  ) {}

  return value;
}

const childHandler: ProxyHandler<InternalState | InternalAsyncState> = {
  get(state, prop: string | typeof ROOT) {
    if (prop == ROOT) {
      if (state._callbacks) {
        return state;
      }

      const root = state[ROOT]!;

      const callbacks: ValueChangeCallbacks = new Set();

      state._get = get;

      state._onValueChange = createSubscribe(callbacks);

      (state as Mutable<typeof state>)._callbacks = callbacks;

      state._valueToggler = 0;

      if ('_load' in root) {
        (state as InternalAsyncState)._subscribeWithError =
          createSubscribeWithError(
            callbacks,
            root._errorState[ROOT]._callbacks,
            root
          );

        if (root._load) {
          (state as InternalAsyncState)._subscribeWithLoad =
            createLoadableSubscribe(callbacks, root);
        }
      }

      return state;
    }

    if (!state._storage) {
      state._children = new Map();

      state._storage = new Map();
    } else if (state._storage.has(prop)) {
      return state._storage.get(prop);
    }

    const nextState = {
      [ROOT]: state[ROOT]!,
      _path: concat(state._path!, prop),
      _callbacks: undefined,
      _children: undefined,
      _storage: undefined,
    } as Partial<InternalState> as InternalState;

    const next = new Proxy(nextState, childHandler);

    state._children!.set(prop, nextState);

    state._storage.set(prop, next);

    return next;
  },
};

const rootHandler: ProxyHandler<InternalState | InternalAsyncState> = {
  get(state, prop: string | typeof ROOT) {
    if (prop == ROOT) {
      return state;
    }

    if (!state._storage) {
      state._children = new Map();

      state._storage = new Map();
    } else if (state._storage.has(prop)) {
      return state._storage.get(prop);
    }

    const nextState = {
      [ROOT]: state,
      _path: [prop],
      _callbacks: undefined,
      _children: undefined,
      _storage: undefined,
    } as Partial<InternalState> as InternalState;

    const next = new Proxy(nextState, childHandler);

    state._children!.set(prop, nextState);

    state._storage.set(prop, next);

    return next;
  },
};

const createScope = (state: InternalState | InternalAsyncState): any =>
  new Proxy(state, rootHandler);

export default createScope;
