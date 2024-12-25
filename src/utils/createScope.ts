import type { State } from '../types';
import concat from './concat';
import { $tate } from './constants';

type Child = {
  readonly _state: State;
  readonly _map: Map<string, State | Child>;
  readonly _path: readonly string[];
};

type ScopeMap = Map<typeof $tate, State> & Map<string, Child>;

const childHandler: ProxyHandler<Child> = {
  get(target, prop: string) {
    const { _map } = target;

    if (_map.has(prop)) {
      return _map.get(prop);
    }

    const next =
      prop != $tate
        ? new Proxy(
            {
              _map: new Map(),
              _path: concat(target._path, prop),
              _state: target._state,
            } as Child,
            childHandler
          )
        : ({ ...target._state, _path: target._path } as State);

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
