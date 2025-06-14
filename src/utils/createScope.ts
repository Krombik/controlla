import type {
  InternalAsyncControl,
  InternalControl,
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

function get(this: InternalControl) {
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

const childHandler: ProxyHandler<InternalControl | InternalAsyncControl> = {
  get(control, prop: string | typeof ROOT) {
    if (prop == ROOT) {
      if (control._callbacks) {
        return control;
      }

      const root = control[ROOT]!;

      const callbacks: ValueChangeCallbacks = new Set();

      control._get = get;

      control._subscribe = createSubscribe(callbacks);

      (control as Mutable<typeof control>)._callbacks = callbacks;

      control._valueToggler = 0;

      if ('_load' in root) {
        (control as InternalAsyncControl)._subscribeWithError =
          createSubscribeWithError(
            callbacks,
            root._errorControl[ROOT]._callbacks,
            root
          );

        if (root._load) {
          (control as InternalAsyncControl)._subscribeWithLoad =
            createLoadableSubscribe(callbacks, root);
        }
      }

      return control;
    }

    if (!control._storage) {
      control._children = new Map();

      control._storage = new Map();
    } else if (control._storage.has(prop)) {
      return control._storage.get(prop);
    }

    const nextControl = {
      [ROOT]: control[ROOT]!,
      _path: concat(control._path!, prop),
      _callbacks: undefined,
      _children: undefined,
      _storage: undefined,
    } as Partial<InternalControl> as InternalControl;

    const next = new Proxy(nextControl, childHandler);

    control._children!.set(prop, nextControl);

    control._storage.set(prop, next);

    return next;
  },
};

const rootHandler: ProxyHandler<InternalControl | InternalAsyncControl> = {
  get(control, prop: string | typeof ROOT) {
    if (prop == ROOT) {
      return control;
    }

    if (!control._storage) {
      control._children = new Map();

      control._storage = new Map();
    } else if (control._storage.has(prop)) {
      return control._storage.get(prop);
    }

    const nextControl = {
      [ROOT]: control,
      _path: [prop],
      _callbacks: undefined,
      _children: undefined,
      _storage: undefined,
    } as Partial<InternalControl> as InternalControl;

    const next = new Proxy(nextControl, childHandler);

    control._children!.set(prop, nextControl);

    control._storage.set(prop, next);

    return next;
  },
};

const createScope = (control: InternalControl | InternalAsyncControl): any =>
  new Proxy(control, rootHandler);

export default createScope;
