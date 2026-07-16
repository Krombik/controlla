import type { PrimitiveControlInternals } from '#internal/types';
import type { Control, SyncExternalStorage } from '#types';
import initControl from '#internal/initControl';
import makePrimitiveInternals from '#internal/makePrimitiveInternals';
import { INTERNALS } from '#internal/constants';

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
    initialValue: T | (() => T),
    syncExternalStorage?: SyncExternalStorage<T>
  ): Control<T>;
} = (
  initialValue?: unknown | (() => unknown),
  syncExternalStorage?: SyncExternalStorage,
  keys?: any[]
) =>
  ({
    [INTERNALS]: initControl<PrimitiveControlInternals>(
      makePrimitiveInternals(undefined),
      initialValue,
      syncExternalStorage,
      keys,
      true
    ),
  }) as any;

export default createPrimitiveControl;
