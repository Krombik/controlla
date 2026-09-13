import type { ControlInternalsChild, ControlInternals } from '#internal/types';
import append from '#internal/append';
import { INTERNALS, EMPTY_ARR } from '#internal/constants';
import makeChildNode from '#internal/makeChildNode';
import type { Control } from '#types';

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
        (nextInternals = makeChildNode(
          internals._root,
          path !== undefined ? append(path, prop) : [prop],
          undefined,
          EMPTY_ARR
        ))
      );
    }

    const next = new Proxy(nextInternals, this);

    storage.set(prop, next);

    return next;
  },
};

function at(this: Control, prop: string) {
  const internals = this[INTERNALS];

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
      (nextInternals = makeChildNode(
        internals._root,
        path !== undefined ? append(path, prop) : [prop],
        undefined,
        EMPTY_ARR
      ))
    );
  }

  const next = { [INTERNALS]: nextInternals, a: at };

  storage.set(prop, next);

  return next;
}

const createScope: <T extends ControlInternals>(internals: T) => any =
  typeof __CONTROLLA_PROXYLESS__ != 'undefined' && __CONTROLLA_PROXYLESS__
    ? (internals) => ({
        [INTERNALS]: internals,
        a: at,
      })
    : (internals) => new Proxy(internals, controlHandler);

export default createScope;
