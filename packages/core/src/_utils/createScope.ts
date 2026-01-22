import type { AsyncControlRoot, ControlChild, ControlRoot } from '#_types';
import alwaysNoop from '#shared/alwaysNoop';
import concat from '#shared/concat';
import { ROOT } from '#shared/constants';
import { createSubscriber } from '#utils/batching';

function get(this: ControlChild) {
  const self = this;

  const path = self._path;

  const l = path.length;

  let value = self._root._value;

  for (let i = 0; i < l; i++) {
    if (value == null) {
      return undefined;
    }

    value = value[path[i]];
  }

  return value;
}

const childHandler: ProxyHandler<ControlChild> = {
  get(control, prop: string | typeof ROOT) {
    if (prop === ROOT) {
      if (control._subscribe == alwaysNoop) {
        control._subscribe = createSubscriber(
          control._callbacks,
          (control._root as AsyncControlRoot)._load || alwaysNoop
        );
      }

      return control;
    }

    if (control._storage) {
      const child = control._storage.get(prop);

      if (child) {
        return child;
      }
    } else {
      control._children = new Map();

      control._storage = new Map();
    }

    const nextControl: ControlChild = {
      _root: control._root,
      _callbacks: [],
      _path: concat(control._path, prop),
      _children: undefined,
      _storage: undefined,
      _get: get,
      _subscribe: alwaysNoop,
      _valueToggler: true,
    };

    const next = new Proxy(nextControl, childHandler);

    control._children!.set(prop, nextControl);

    control._storage.set(prop, next);

    return next;
  },
};

const rootHandler: ProxyHandler<ControlRoot> = {
  get(control, prop: string | typeof ROOT) {
    if (prop === ROOT) {
      return control;
    }

    if (control._storage) {
      const child = control._storage.get(prop);

      if (child) {
        return child;
      }
    } else {
      control._children = new Map();

      control._storage = new Map();
    }

    const nextControl: ControlChild = {
      _root: control,
      _callbacks: [],
      _path: [prop],
      _children: undefined,
      _storage: undefined,
      _get: get,
      _subscribe: alwaysNoop,
      _valueToggler: true,
    };

    const next = new Proxy(nextControl, childHandler);

    control._children!.set(prop, nextControl);

    control._storage.set(prop, next);

    return next;
  },
};

const createScope = (control: ControlRoot): any =>
  new Proxy(control, rootHandler);

export default createScope;
