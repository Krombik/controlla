import type { Mutable, ControlRoot, OnValueChange } from '#_types';
import handleControl from '#utils/handleControl';
import createScope from '#utils/createScope';
import rootGet from '#utils/rootGet';
import type { ControlScope, SyncExternalStorage } from '#types';
import basicEnqueueSet from '#utils/basicEnqueueSet';
import { createSubscriber } from '#utils/batching';
import alwaysNoop from '#shared/alwaysNoop';

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
  const callbacks: OnValueChange[] = [];

  const control = handleControl<ControlRoot>(
    {
      _value: undefined,
      _root: undefined!,
      _get: rootGet,
      _callbacks: callbacks,
      _enqueueSet: basicEnqueueSet,
      _subscribe: createSubscriber(callbacks, alwaysNoop),
      _children: undefined,
      _valueToggler: true,
      _unobserve: undefined,
      _patchNode: {
        _children: new Map(),
        _childrenKeys: [],
        _isObject: true,
        _prevValue: undefined,
        _set: false,
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
