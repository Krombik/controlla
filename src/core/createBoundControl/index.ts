import type { PrimitiveOrNested } from 'keyweaver';
import type { Bound, Control, MixedKeys, Registry } from '#types';
import makeBoundControl from '#internal/makeBoundControl';

/**
 * Creates a control bound to the given {@link keys} of a
 * {@link Registry registry}, where a key can be a control: it mirrors the item
 * under the keys' current values and rebinds to another item when a key
 * control's value changes. While the new item has no value yet, it shows
 * `undefined` — or keeps the previous value if the registry was created with
 * the `keepPrev` option (`suppressError` additionally holds it through
 * errors).
 *
 * Every call builds its own, so it lives as long as whoever created it: at
 * module level or in a `createControlsContext` bag, for good;
 * {@link useBoundControl} is the one to use inside a component.
 *
 * @example
 * ```ts
 * const $selectedUser = createBoundControl(userRegistry, $selectedId);
 * ```
 */
const createBoundControl = <
  T extends Control,
  Keys extends Exclude<PrimitiveOrNested, undefined>[],
  const K extends MixedKeys<Keys>,
>(
  registry: Registry<T, Keys>,
  ...keys: K
): Bound<T, K> => makeBoundControl(registry, keys);

export default createBoundControl;
