import type { ControlInternals, Lane, PatchTreeNode } from '#internal/types';
import createScope from '#internal/createScope';
import type { ControlScope, SyncExternalStorage } from '#types';
import { commitPatchNode, UNCHANGED } from '#internal/commitPatchNode';
import initControl from '#internal/initControl';
import readRootValue from '#internal/readRootValue';
import { EMPTY_ARR } from '#internal/constants';
import notify from '#internal/notify';
import runPatching from '#internal/runPatching';
import { attach, detach } from '#internal/syncLifecycle';

function enqueueSet(
  this: ControlInternals,
  value: any,
  lane: Lane,
  path: string[] | undefined
) {
  runPatching(lane, this, value, path);
}

function commitSet(
  this: ControlInternals,
  patchNode: PatchTreeNode,
  lane: Lane
) {
  const root = this;

  const prevValue = root._value;

  const nextValue = commitPatchNode(patchNode, prevValue, root, lane);

  if (nextValue !== UNCHANGED) {
    root._value = nextValue;

    notify(root._listeners, root._dependents, lane, nextValue, prevValue);

    if (root._externalStorage) {
      root._externalStorage.set(nextValue);
    }
  }
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
) =>
  createScope(
    initControl<ControlInternals>(
      {
        _root: undefined!,
        _get: readRootValue,
        _listeners: EMPTY_ARR,
        _indexMap: undefined,
        _dependents: EMPTY_ARR,
        _path: undefined,
        _children: undefined,
        _storage: undefined,
        _level: 0,
        _value: undefined,
        _attach: attach,
        _detach: detach,
        _load: false,
        _commitSet: commitSet,
        _enqueueSet: enqueueSet,
        _externalStorage: undefined,
      },
      value,
      syncExternalStorage,
      keys,
      true
    )
  );

export default createControl;
