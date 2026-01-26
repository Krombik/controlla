import type { Mutable, RootControlNode, ChangeListener } from '#internal/types';
import initControl from '#internal/initControl';
import createScope from '#internal/createScope';
import readRootValue from '#internal/readRootValue';
import type { ControlScope, SyncExternalStorage } from '#types';
import basicEnqueueSet from '#internal/basicEnqueueSet';
import { createSubscriber } from '#internal/flushQueue';
import alwaysNoop from '#shared-internal/alwaysNoop';

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
      _enqueueSet: basicEnqueueSet,
      _subscribe: createSubscriber(callbacks, alwaysNoop),
      _children: undefined,
      _versionToggle: true,
      _unobserve: undefined,
      _patchNode: {
        _children: new Map(),
        _patchedKeys: [],
        _isObject: true,
        _prevValue: undefined,
        _hasValuePatch: false,
        _value: undefined,
      },
      _path: undefined,
      _stale: true,
      _storage: undefined,
    },
    value,
    syncExternalStorage,
    keys
  );

  (control as Mutable<typeof control>)._root = control;

  return createScope(control);
};

export default createControl;
