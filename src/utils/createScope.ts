import type {
  LoadableState,
  ScopeCallbackMap,
  State,
  ValueChangeCallbacks,
} from '../types';
import concat from './concat';
import { $tate } from './constants';
import {
  createLoadableSubscribe,
  createSubscribeWithError,
} from './createAsyncSubscribe';
import createSubscribe from './createSubscribe';
import { load } from './state/wrapped';

type Child = {
  readonly _root: State | LoadableState<any, any, any>;
  readonly _storage: ScopeMap;
  readonly _path: readonly string[];
  _parent: ScopeCallbackMap;
};

type ScopeMap = Map<typeof $tate, State | LoadableState<any, any, any>> &
  Map<string, Child>;

function get(this: State) {
  const path = this._path!;

  const l = path.length;

  let value = this._root!._value;

  for (
    let i = 0;
    i < l && (value = value ? value[path[i]] : undefined) !== undefined;
    i++
  ) {}

  return value;
}

function set(this: State, value: any) {
  return this._root!.set(value, this._path, false);
}

const childHandler: ProxyHandler<Child> = {
  get(target, prop: string) {
    const { _storage } = target;

    if (_storage.has(prop)) {
      return _storage.get(prop);
    }

    const rootState = target._root;

    const currentState = target._parent;

    let next;

    if (prop != $tate) {
      const nextState: ScopeCallbackMap = { _children: undefined };

      next = new Proxy(
        {
          _storage: new Map(),
          _root: rootState,
          _path: concat(target._path, prop),
          _parent: nextState,
        },
        childHandler
      );

      if (!currentState._children) {
        currentState._children = new Map();
      }

      currentState._children.set(prop, nextState);
    } else {
      const callbacks: ValueChangeCallbacks = new Set();

      next = Object.assign(
        currentState,
        '_load' in rootState
          ? ({
              _root: rootState,
              _path: target._path,
              get,
              set,
              _onValueChange: createSubscribe(callbacks),
              _subscribeWithError: createSubscribeWithError(
                callbacks,
                rootState.error._callbacks,
                rootState
              ),
              _subscribeWithLoad:
                rootState._load &&
                createLoadableSubscribe(callbacks, rootState),
              _callbacks: callbacks,
              load: rootState._load && load,
              control: rootState.control,
              error: rootState.error,
              isLoaded: rootState.isLoaded,
              _valueToggler: 0,
              _children: currentState._children,
            } as Partial<LoadableState<any, any, any>> as LoadableState<
              any,
              any,
              any
            >)
          : ({
              _root: rootState,
              _path: target._path,
              get,
              set,
              _onValueChange: createSubscribe(callbacks),
              _callbacks: callbacks,
              _valueToggler: 0,
              _children: currentState._children,
            } as State)
      );
    }

    _storage.set(prop, next as any);

    return next;
  },
};

const rootHandler: ProxyHandler<ScopeMap> = {
  get(_storage, prop: string) {
    if (_storage.has(prop)) {
      return _storage.get(prop);
    }

    const state = _storage.get($tate)!;

    const nextState: ScopeCallbackMap = { _children: undefined };

    const next = new Proxy(
      {
        _storage: new Map(),
        _root: state,
        _path: [prop],
        _parent: nextState,
      },
      childHandler
    );

    if (!state._children) {
      state._children = new Map();
    }

    state._children.set(prop, nextState);

    _storage.set(prop, next);

    return next;
  },
};

const createScope = (state: State): any =>
  new Proxy(new Map().set($tate, state), rootHandler);

export default createScope;
