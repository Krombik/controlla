import type { ControlInternals, Lane, PatchTreeNode } from '#internal/types';
import createScope from '#internal/createScope';
import type { ControlScope, SyncExternalStorage } from '#types';
import { commitPatchNode, UNCHANGED } from '#internal/commitPatchNode';
import initControl from '#internal/initControl';
import readRootValue from '#internal/readRootValue';
import { EMPTY_ARR } from '#internal/constants';
import runPatching from '#internal/runPatching';
import { attach, detach } from '#internal/syncLifecycle';
import { notify } from '#internal/flushQueue';

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
 * Creates a {@link ControlScope control} with granular reactivity over its
 * value: nested fields are reachable as controls of their own via property
 * access, and a change notifies only the paths it actually touched.
 *
 * The initial {@link value} can be a plain value or a lazy initializer.
 * Pass a {@link syncExternalStorage} to back the value with an external
 * storage — the control starts from the stored value and writes changes
 * back (and, if the storage is observable, picks up external changes).
 *
 * For simple values that don't need nested access, prefer
 * `createPrimitiveControl` — it skips the scope proxy entirely.
 *
 * @example
 * ```ts
 * const $user = createControl({ profile: { name: 'John', age: 30 } });
 *
 * // nested fields are controls
 * const $name = $user.profile.name;
 *
 * setValue($name, 'Jane');          // notifies $name (and $user) listeners,
 *                                   // but not $user.profile.age
 *
 * // lazy initializer
 * const $draft = createControl(() => ({ id: crypto.randomUUID(), text: '' }));
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
