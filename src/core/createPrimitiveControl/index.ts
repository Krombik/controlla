import type {
  ControlInternals,
  Lane,
  PrimitiveControlInternals,
} from '#internal/types';
import type { Control, SyncExternalStorage } from '#types';
import initControl from '#internal/initControl';
import readRootValue from '#internal/readRootValue';
import { EMPTY_ARR, INTERNALS } from '#internal/constants';
import notify from '#internal/notify';
import addToLevel from '#internal/addToLevel';
import { attach, detach } from '#internal/syncLifecycle';

function enqueueSet(this: ControlInternals, value: any, lane: Lane) {
  const patchByControl = lane._patchByControl;

  if (!patchByControl.has(this)) {
    addToLevel(lane, this);
  }

  patchByControl.set(this, value);
}

function commitSet(this: ControlInternals, nextValue: any, lane: Lane) {
  const root = this;

  const prevValue = root._value;

  if (nextValue !== prevValue) {
    root._value = nextValue;

    notify(root._listeners, root._dependents, lane, nextValue, prevValue);

    if (root._externalStorage) {
      root._externalStorage.set(nextValue);
    }
  }
}

/**
 * Creates a lightweight {@link Control control} without the scope proxy —
 * a cheaper alternative to `createControl` when nested-path subscriptions
 * aren't needed.
 *
 * The value is treated as opaque: changes are detected by reference
 * (`!==`), so replace objects instead of mutating them, and nested fields
 * can't be accessed via the control. For granular reactivity over object
 * values use `createControl` instead.
 *
 * @example
 * ```ts
 * const $counter = createPrimitiveControl(0);
 *
 * setValue($counter, (prev) => prev + 1);
 * ```
 */
const createPrimitiveControl: {
  <T>(): Control<T | undefined>;
  <T>(
    value: T | (() => T),
    syncExternalStorage?: SyncExternalStorage<T>
  ): Control<T>;
} = (
  value?: unknown | (() => unknown),
  syncExternalStorage?: SyncExternalStorage,
  keys?: any[]
) =>
  ({
    [INTERNALS]: initControl<PrimitiveControlInternals>(
      {
        _root: undefined!,
        _get: readRootValue,
        _listeners: EMPTY_ARR,
        _indexMap: undefined,
        _dependents: EMPTY_ARR,
        _path: undefined,
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
    ),
  }) as any;

export default createPrimitiveControl;
