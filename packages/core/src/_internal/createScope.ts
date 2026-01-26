import type {
  AsyncRootNode,
  ChildControlNode,
  RootControlNode,
} from '#internal/types';
import alwaysNoop from '#shared-internal/alwaysNoop';
import append from '#shared-internal/append';
import { INTERNALS } from '#shared-internal/constants';
import { createSubscriber } from '#internal/flushQueue';

function get(this: ChildControlNode) {
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

const childHandler: ProxyHandler<ChildControlNode> = {
  get(control, prop: string | typeof INTERNALS) {
    if (prop === INTERNALS) {
      if (control._subscribe == alwaysNoop) {
        control._subscribe = createSubscriber(
          control._listeners,
          (control._root as AsyncRootNode)._attachLoad || alwaysNoop
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

    const nextControl: ChildControlNode = {
      _root: control._root,
      _listeners: [],
      _path: append(control._path, prop),
      _children: undefined,
      _storage: undefined,
      _get: get,
      _subscribe: alwaysNoop,
      _versionToggle: true,
    };

    const next = new Proxy(nextControl, childHandler);

    control._children!.set(prop, nextControl);

    control._storage.set(prop, next);

    return next;
  },
};

const rootHandler: ProxyHandler<RootControlNode> = {
  get(control, prop: string | typeof INTERNALS) {
    if (prop === INTERNALS) {
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

    const nextControl: ChildControlNode = {
      _root: control,
      _listeners: [],
      _path: [prop],
      _children: undefined,
      _storage: undefined,
      _get: get,
      _subscribe: alwaysNoop,
      _versionToggle: true,
    };

    const next = new Proxy(nextControl, childHandler);

    control._children!.set(prop, nextControl);

    control._storage.set(prop, next);

    return next;
  },
};

const createScope = (control: RootControlNode): any =>
  new Proxy(control, rootHandler);

export default createScope;
