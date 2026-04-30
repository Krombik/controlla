import type { ControlInternalsChild, ControlInternals } from '#internal/types';
import append from '#shared-internal/append';
import { INTERNALS } from '#shared-internal/constants';
import { EMPTY_ARR } from '#internal/constants';

function get(this: ControlInternalsChild) {
  const path = this._path;

  let value = this[INTERNALS]._value;

  for (let i = 0; i < path!.length; i++) {
    if (value == null) {
      return undefined;
    }

    value = value[path![i]];
  }

  return value;
}

const controlHandler: ProxyHandler<ControlInternals | ControlInternalsChild> = {
  get(internals, prop: string | typeof INTERNALS) {
    if (prop === INTERNALS) {
      return internals;
    }

    let storage = internals._storage;

    let children: Map<string, ControlInternalsChild> | undefined;

    if (storage !== undefined) {
      const control = storage.get(prop);

      if (control !== undefined) {
        return control;
      }

      children = internals._children;
    } else {
      internals._storage = storage = new Map();

      children = internals._children;

      if (children === undefined) {
        internals._children = children = new Map();
      }
    }

    let nextInternals = children!.get(prop);

    if (nextInternals === undefined) {
      const path = internals._path;

      children!.set(
        prop,
        (nextInternals = {
          _get: get,
          _listeners: EMPTY_ARR,
          _indexMap: undefined,
          _dependents: EMPTY_ARR,
          _path: path !== undefined ? append(path, prop) : [prop],
          [INTERNALS]: internals[INTERNALS],
          _children: undefined,
          _storage: undefined,
          _data: undefined,
        })
      );
    }

    const next = new Proxy(nextInternals, this);

    storage.set(prop, next);

    return next;
  },
};

const createScope = <T extends ControlInternals>(internals: T): any =>
  new Proxy(internals, controlHandler);

export default createScope;
