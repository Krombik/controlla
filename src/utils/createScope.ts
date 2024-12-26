import type { AsyncState, LoadableState, State } from '../types';
import concat from './concat';
import { $tate } from './constants';
import { load } from './state/wrapped';

type Child = {
  readonly _state: State | LoadableState<any, any, any>;
  readonly _map: Map<string, State | Child>;
  readonly _path: readonly string[];
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

function _onValueChange(this: State, cb: (value: any) => void) {
  return this._root!._onValueChange(cb, this._path);
}

const childHandler: ProxyHandler<Child> = {
  get(target, prop: string) {
    const { _map } = target;

    if (_map.has(prop)) {
      return _map.get(prop);
    }

    const state = target._state;

    const next =
      prop != $tate
        ? new Proxy(
            {
              _map: new Map(),
              _path: concat(target._path, prop),
              _state: state,
            } as Child,
            childHandler
          )
        : '_load' in state
          ? ({
              _root: state,
              _path: target._path,
              get,
              set,
              load: (state as AsyncState)._load && load,
              control: state.control,
              error: state.error,
              isLoaded: state.isLoaded,
              _onValueChange,
            } as Partial<LoadableState<any, any, any>> as LoadableState<
              any,
              any,
              any
            >)
          : ({
              _root: state,
              _path: target._path,
              get,
              set,
              _onValueChange,
            } as State);

    _map.set(prop, next);

    return next;
  },
};

const rootHandler: ProxyHandler<ScopeMap> = {
  get(_map, prop: string) {
    if (_map.has(prop)) {
      return _map.get(prop);
    }

    const next = new Proxy(
      {
        _map: new Map(),
        _path: [prop],
        _state: _map.get($tate)!,
      },
      childHandler
    );

    _map.set(prop, next);

    return next;
  },
};

const createScope = (state: State) => {
  const map: ScopeMap = new Map();

  map.set($tate, state);

  return new Proxy(map, rootHandler) as any;
};

export default createScope;
