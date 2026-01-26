import createScope from '#internal/createScope';
import {
  addAfterFlushHook,
  createSubscriber,
  enqueueDerivedSet,
} from '#internal/flushQueue';
import readRootValue from '#internal/readRootValue';
import {
  AsyncRootNode,
  ChangeListener,
  ChildControlNode,
  Mutable,
  RootControlNode,
} from '#internal/types';
import alwaysNoop from '#shared-internal/alwaysNoop';
import { INTERNALS } from '#shared-internal/constants';
import identity from 'lodash.identity';

const makeDerivedControl = (params: any[]) => {
  const controlCount = params.length - 1;

  const listeners: ChangeListener[] = [];

  let initialValue: any;

  let attachLoad: (() => () => void) | undefined;

  let detachSubscriptions: () => void;

  if (controlCount > 1) {
    const unsubscribers = Array<() => void>(controlCount);

    const seenAttachLoads = new Set<() => () => void>();

    const attachLoads: Array<() => () => void> = [];

    const values = Array(controlCount);

    const flushDerivedUpdate = () => {
      controlRoot._enqueueSet(combine(...values));

      canSchedule = true;
    };

    let canSchedule = true;

    for (let i = 0; i < controlCount; i++) {
      const control: ChildControlNode = params[i][INTERNALS];

      if (
        control._root &&
        (control._root as AsyncRootNode)._attachLoad !== alwaysNoop
      ) {
        const load = (control._root as AsyncRootNode)._attachLoad;

        if (!seenAttachLoads.has(load)) {
          seenAttachLoads.add(load);

          attachLoads.push(load);
        }
      }

      unsubscribers[i] = control._subscribe((newValue) => {
        values[i] = newValue;

        if (canSchedule) {
          canSchedule = false;

          addAfterFlushHook(flushDerivedUpdate);
        }
      }, true);

      values[i] = control._get();
    }

    const combine: (...values: any[]) => any = params[controlCount];

    const loaderCount = attachLoads.length;

    initialValue = combine(...values);

    detachSubscriptions = () => {
      for (let i = 0; i < controlCount; i++) {
        unsubscribers[i]();
      }
    };

    if (loaderCount) {
      attachLoad =
        loaderCount == 1
          ? attachLoads[0]
          : () => {
              const unloads = Array(loaderCount);

              for (let i = 0; i < loaderCount; i++) {
                unloads[i] = attachLoads[i]();
              }

              return () => {
                for (let i = 0; i < loaderCount; i++) {
                  unloads[i]();
                }
              };
            };
    }
  } else {
    const control: ChildControlNode = params[0][INTERNALS];

    const mapValue = controlCount ? params[1] : identity;

    if (control._root) {
      attachLoad = (control._root as AsyncRootNode)._attachLoad;
    }

    detachSubscriptions = control._subscribe((nextValue) => {
      controlRoot._enqueueSet(mapValue(nextValue));
    }, true);

    initialValue = mapValue(control._get());
  }

  const controlRoot: RootControlNode = {
    _children: undefined,
    _enqueueSet: enqueueDerivedSet,
    _get: readRootValue,
    _listeners: listeners,
    _patchNode: {
      _children: new Map(),
      _hasValuePatch: false,
      _isObject: true,
      _patchedKeys: [],
      _prevValue: initialValue,
      _value: initialValue,
    },
    _path: undefined,
    _root: undefined!,
    _stale: true,
    _storage: undefined,
    _subscribe: createSubscriber(listeners, attachLoad || alwaysNoop),
    _unobserve: detachSubscriptions,
    _value: initialValue,
    _versionToggle: true,
  };

  (controlRoot as Mutable<typeof controlRoot>)._root = controlRoot;

  return createScope(controlRoot);
};

export default makeDerivedControl;
