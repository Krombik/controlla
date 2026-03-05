import type { Mutable, RootControlNode, ChangeListener } from '#internal/types';
import initControl from '#internal/initControl';
import createScope from '#internal/createScope';
import readRootValue from '#internal/readRootValue';
import type { ControlScope, Scheduler, SyncExternalStorage } from '#types';
import createSubscriber from '#internal/createSubscriber';
import noop from 'lodash.noop';
import useVersionedSync from '#internal/useVersionedSync';
import { getLane, scheduleFlush } from '#internal/flushQueue';
import runPatching from '#internal/runPatching';
import { commitSet } from '#internal/commitPatchNode';

function enqueueSet(
  this: RootControlNode,
  value: any,
  scheduler: Scheduler,
  path: string[] | undefined
) {
  const lane = getLane(scheduler);

  runPatching(lane, this, value, path);

  scheduleFlush(lane, scheduler);
}

/**
 * Creates a {@link ControlScope control scope} for managing complex control structures.
 *
 * @example
 * ```js
 * const control1Scope = createControlScope();
 *
 * const control2Scope = createControlScope({ name: 'John' });
 *
 * const control3Scope = createControlScope(() => ({ name: 'John' }));
 * ```
 */
const createControl: {
  <T>(): ControlScope<T | undefined>;
  <T>(
    value: T | (() => T),
    syncExternalStorage?: SyncExternalStorage<T>
  ): ControlScope<T>;
} = (
  value?: unknown | (() => unknown),
  syncExternalStorage?: SyncExternalStorage,
  keys?: any[]
) => {
  const callbacks: ChangeListener[] = [];

  const control = initControl<RootControlNode>(
    {
      _value: undefined,
      _root: undefined!,
      _get: readRootValue,
      _listeners: callbacks,
      _enqueueSet: enqueueSet,
      _subscribe: createSubscriber(callbacks),
      _children: undefined,
      _version: 0,
      _useSubscribeWithLoad: useVersionedSync,
      _useCleanup: noop,
      _path: undefined,
      _storage: undefined,
      _commitSet: commitSet,
    },
    value,
    syncExternalStorage,
    keys
  );

  (control as Mutable<typeof control>)._root = control;

  return createScope(control);
};

export default createControl;
