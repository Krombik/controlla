import createScope from '#internal/createScope';
import { getLane, getCurrentLane, scheduleFlush } from '#internal/flushQueue';
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
import runPatching from '#internal/runPatching';
import type { Scheduler } from '#types';
import useVersionedSync from '#internal/useVersionedSync';
import createSubscriber from '#internal/createSubscriber';
import { commitSet } from './commitPatchNode';

function enqueueDerivedSet(
  this: RootControlNode,
  nextValue: any,
  scheduler: Scheduler,
  path?: readonly string[]
) {
  const lane = getLane(scheduler);

  lane._afterFlushHooks.push(() => {
    runPatching(lane, this, nextValue, path);
  });

  scheduleFlush(lane, scheduler);
}

const makeDerivedControl = (params: any[]) => {
  const controlCount = params.length - 1;

  const listeners: ChangeListener[] = [];

  let initialValue: any;

  let attachLoad: (() => () => void) | undefined;

  let detachSubscriptions: () => void;

  if (controlCount > 1) {
    const unsubscribers = Array<() => void>(controlCount);

    const seenLoadableRoots = new Set<AsyncRootNode>();

    const loadableRoots: Array<AsyncRootNode> = [];

    const values = Array(controlCount);

    let canSchedule = true;

    for (let i = 0; i < controlCount; i++) {
      const scopedIndex = i;

      const control: ChildControlNode = params[i][INTERNALS];

      const root = control._root as AsyncRootNode;

      if (
        root &&
        '_attachLoad' in root &&
        root._attachLoad != alwaysNoop &&
        !seenLoadableRoots.has(root)
      ) {
        seenLoadableRoots.add(root);

        loadableRoots.push(root);
      }

      unsubscribers[i] = control._subscribe((newValue) => {
        values[scopedIndex] = newValue;

        if (canSchedule) {
          canSchedule = false;

          const currentLane = getCurrentLane()!;

          currentLane._afterFlushHooks.push(() => {
            runPatching(
              currentLane,
              controlRoot,
              combine(...values),
              undefined
            );

            canSchedule = true;
          });
        }
      }, true);

      values[i] = control._get();
    }

    const combine: (...values: any[]) => any = params[controlCount];

    const loaderCount = loadableRoots.length;

    initialValue = combine(...values);

    detachSubscriptions = () => {
      for (let i = 0; i < controlCount; i++) {
        unsubscribers[i]();
      }
    };

    if (loaderCount) {
      if (loaderCount == 1) {
        const root = loadableRoots[0];

        attachLoad = () => root._attachLoad();
      } else {
        attachLoad = () => {
          const unloads = Array<() => void>(loaderCount);

          for (let i = 0; i < loaderCount; i++) {
            unloads[i] = loadableRoots[i]._attachLoad();
          }

          return () => {
            for (let i = 0; i < loaderCount; i++) {
              unloads[i]();
            }
          };
        };
      }
    }
  } else {
    const control: ChildControlNode = params[0][INTERNALS];

    const mapValue = controlCount ? params[1] : identity;

    const root = control._root as AsyncRootNode;

    if (root && '_attachLoad' in root && root._attachLoad != alwaysNoop) {
      attachLoad = () => root._attachLoad();
    }

    detachSubscriptions = control._subscribe((nextValue) => {
      const currentLane = getCurrentLane()!;

      currentLane._afterFlushHooks.push(() => {
        runPatching(currentLane, controlRoot, mapValue(nextValue), undefined);
      });
    }, true);

    initialValue = mapValue(control._get());
  }

  const controlRoot: RootControlNode = {
    _children: undefined,
    _enqueueSet: enqueueDerivedSet,
    _get: readRootValue,
    _listeners: listeners,
    _path: undefined,
    _root: undefined!,
    _storage: undefined,
    _subscribe: createSubscriber(
      listeners,
      attachLoad && { _attachLoad: attachLoad }
    ),
    _useCleanup: detachSubscriptions,
    _value: initialValue,
    _version: 0,
    _useSubscribeWithLoad: useVersionedSync,
    _commitSet: commitSet,
  };

  (controlRoot as Mutable<typeof controlRoot>)._root = controlRoot;

  return createScope(controlRoot);
};

export default makeDerivedControl;
